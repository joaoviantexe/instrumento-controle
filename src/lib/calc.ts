/**
 * Fórmulas do instrumento, reproduzidas a partir da planilha original.
 * Cada função indica a coluna/aba de origem.
 */
import {
  DISTRITOS,
  ITEM_POR_CODIGO,
  LISTA_MESTRA,
  SECAO_VISITA,
  SECOES,
  SITUACOES_ITEM,
} from '../data/planilha';
import type { Acao, Auditoria, Avaliacao, ItemLista, SituacaoItem, Unidade } from './types';
import { diasEntre, hojeISO } from './format';

export const NAO_AVALIADO: SituacaoItem = 'Não avaliado';
export const NAO_SE_APLICA: SituacaoItem = 'Não se aplica';
export const CONFORME: SituacaoItem = 'Conforme';
export const PARCIAL: SituacaoItem = 'Parcialmente conforme';
export const NAO_CONFORME: SituacaoItem = 'Não conforme';
export const PESO_CRITICO = 3;

/** Auditoria Documental, coluna M: =IF(OR(K="Não se aplica",K="",J=0),0,J) */
export function pesoAplicavel(situacao: string, peso: number): number {
  return situacao === NAO_SE_APLICA || !situacao || peso === 0 ? 0 : peso;
}

/** Auditoria Documental, coluna N: =IF(K="Conforme",M,IF(K="Parcialmente conforme",M*0.5,0)) */
export function pontos(situacao: string, pesoAplic: number): number {
  if (situacao === CONFORME) return pesoAplic;
  if (situacao === PARCIAL) return pesoAplic * 0.5;
  return 0;
}

/** Auditoria Documental, coluna O: =IF(M=0,"",N/M) */
export function indiceItem(situacao: string, peso: number): number | null {
  const m = pesoAplicavel(situacao, peso);
  return m === 0 ? null : pontos(situacao, m) / m;
}

export function avaliado(situacao: string): boolean {
  return !!situacao && situacao !== NAO_AVALIADO;
}

export function avaliacaoPadrao(auditoria_id: string, item: string): Avaliacao {
  return {
    auditoria_id,
    item,
    situacao: NAO_AVALIADO,
    evidencia: '',
    achado: '',
    requer_acao: 'Não',
    prazo: '',
    responsavel: '',
    situacao_acao: '',
  };
}

export interface Linha extends Avaliacao {
  def: ItemLista;
  pesoAplicavel: number;
  pontos: number;
  indice: number | null;
}

export type MapaAvaliacoes = Map<string, Map<string, Avaliacao>>;

export function indexarAvaliacoes(avaliacoes: Avaliacao[]): MapaAvaliacoes {
  const mapa: MapaAvaliacoes = new Map();
  for (const a of avaliacoes) {
    let m = mapa.get(a.auditoria_id);
    if (!m) mapa.set(a.auditoria_id, (m = new Map()));
    m.set(a.item, a);
  }
  return mapa;
}

export function montarLinha(av: Avaliacao): Linha {
  const def = ITEM_POR_CODIGO[av.item];
  const peso = def?.peso ?? 0;
  const pa = pesoAplicavel(av.situacao, peso);
  return {
    ...av,
    def,
    pesoAplicavel: pa,
    pontos: pontos(av.situacao, pa),
    indice: pa === 0 ? null : pontos(av.situacao, pa) / pa,
  };
}

/** As 53 linhas do bloco de uma auditoria (itens sem registro ficam "Não avaliado"). */
export function linhasDaAuditoria(auditoriaId: string, mapa: MapaAvaliacoes): Linha[] {
  const registros = mapa.get(auditoriaId);
  return LISTA_MESTRA.map((def) =>
    montarLinha(registros?.get(def.codigo) ?? avaliacaoPadrao(auditoriaId, def.codigo)),
  );
}

export interface ResumoAuditoria {
  iniciada: boolean;
  /** Plano de Auditoria, coluna J */
  previstos: number;
  /** Plano de Auditoria, coluna K */
  avaliados: number;
  somaPontos: number;
  somaPeso: number;
  /** Plano de Auditoria, coluna L (null quando não há bloco iniciado) */
  indice: number | null;
  /** Plano de Auditoria, coluna M */
  ncCriticas: number;
  /** Plano de Auditoria, coluna N */
  checklist: number | null;
  naoConformes: number;
}

export function resumirLinhas(linhas: Linha[], iniciada = true): ResumoAuditoria {
  if (!iniciada) {
    return {
      iniciada: false,
      previstos: 0,
      avaliados: 0,
      somaPontos: 0,
      somaPeso: 0,
      indice: null,
      ncCriticas: 0,
      checklist: null,
      naoConformes: 0,
    };
  }
  let avaliados = 0;
  let somaPontos = 0;
  let somaPeso = 0;
  let ncCriticas = 0;
  let naoConformes = 0;
  let visitaAvaliados = 0;
  for (const l of linhas) {
    if (avaliado(l.situacao)) avaliados++;
    somaPontos += l.pontos;
    somaPeso += l.pesoAplicavel;
    if (l.situacao === NAO_CONFORME) {
      naoConformes++;
      if (l.def?.peso === PESO_CRITICO) ncCriticas++;
    }
    if (l.def?.secao === SECAO_VISITA && avaliado(l.situacao)) visitaAvaliados++;
  }
  const totalVisita = LISTA_MESTRA.filter((i) => i.secao === SECAO_VISITA).length;
  return {
    iniciada: true,
    previstos: linhas.length,
    avaliados,
    somaPontos,
    somaPeso,
    // =IFERROR(SUMIFS(N)/SUMIFS(M),0)
    indice: somaPeso === 0 ? 0 : somaPontos / somaPeso,
    ncCriticas,
    checklist: totalVisita ? visitaAvaliados / totalVisita : 0,
    naoConformes,
  };
}

export function resumirAuditoria(aud: Auditoria, mapa: MapaAvaliacoes): ResumoAuditoria {
  return resumirLinhas(aud.iniciada ? linhasDaAuditoria(aud.id, mapa) : [], aud.iniciada);
}

/** Todas as linhas registradas na Auditoria Documental (blocos iniciados). */
export function linhasRegistradas(auditorias: Auditoria[], mapa: MapaAvaliacoes): Linha[] {
  return auditorias.filter((a) => a.iniciada).flatMap((a) => linhasDaAuditoria(a.id, mapa));
}

export type Contagem = Record<SituacaoItem, number>;

/** Dashboard T4:U8 — COUNTIF por situação. */
export function contarSituacoes(linhas: Linha[]): Contagem {
  const c = Object.fromEntries(SITUACOES_ITEM.map((s) => [s, 0])) as Contagem;
  for (const l of linhas) if (l.situacao in c) c[l.situacao]++;
  return c;
}

/** Dashboard P6: =IFERROR(SUM(N)/SUM(M),0) */
export function indiceGlobal(linhas: Linha[]): number {
  const m = linhas.reduce((s, l) => s + l.pesoAplicavel, 0);
  const n = linhas.reduce((s, l) => s + l.pontos, 0);
  return m === 0 ? 0 : n / m;
}

export interface LinhaMatriz {
  secao: string;
  contagem: Contagem;
  total: number;
  /** Relatórios, coluna H: vazio quando a seção não tem peso técnico. */
  indice: number | null;
}

/** Relatórios A6:H13 — matriz por seção do Checklist. */
export function matrizSecoes(linhas: Linha[]): LinhaMatriz[] {
  return SECOES.map((secao) => {
    const ls = linhas.filter((l) => l.def?.secao === secao);
    const contagem = contarSituacoes(ls);
    const m = ls.reduce((s, l) => s + l.pesoAplicavel, 0);
    const n = ls.reduce((s, l) => s + l.pontos, 0);
    return {
      secao,
      contagem,
      total: Object.values(contagem).reduce((a, b) => a + b, 0),
      indice: m === 0 ? null : n / m,
    };
  });
}

export const VINCULO_MUNICIPAL = 'MUNICIPAL';
export const VINCULO_OSC = 'OSC/CONVENIADA';

export interface LinhaDistrito {
  distrito: string;
  municipal: number;
  osc: number;
  total: number;
  participacao: number;
}

/** Relatórios A17:E25 e Dashboard T21:V29. */
export function distribuicaoDistritos(unidades: Unidade[]): LinhaDistrito[] {
  const extras = unidades.map((u) => u.distrito).filter((d) => d && !DISTRITOS.includes(d));
  const lista = [...DISTRITOS, ...Array.from(new Set(extras)).sort()];
  const total = unidades.length;
  return lista.map((distrito) => {
    const doDistrito = unidades.filter((u) => u.distrito === distrito);
    const municipal = doDistrito.filter((u) => u.rede === VINCULO_MUNICIPAL).length;
    const osc = doDistrito.filter((u) => u.rede === VINCULO_OSC).length;
    return {
      distrito,
      municipal,
      osc,
      total: municipal + osc,
      participacao: total ? (municipal + osc) / total : 0,
    };
  });
}

export interface IndicadorQualidade {
  indicador: string;
  registros: number;
  cobertura: number;
}

/** Dashboard N27:Q32 — qualidade do cadastro territorial. */
export function qualidadeCadastro(unidades: Unidade[], rotulos: string[]): IndicadorQualidade[] {
  const total = unidades.length;
  const preenchido = (campo: keyof Unidade) => unidades.filter((u) => String(u[campo] ?? '').trim()).length;
  const valores = [
    preenchido('endereco'),
    preenchido('cep'),
    preenchido('telefone'),
    preenchido('email'),
    unidades.filter((u) => u.situacao === 'ATIVA').length,
  ];
  return rotulos.map((indicador, i) => ({
    indicador,
    registros: valores[i] ?? 0,
    cobertura: total ? (valores[i] ?? 0) / total : 0,
  }));
}

/** Plano de Ação, coluna K: =IF(J="","",J-TODAY()) */
export function diasRestantes(prazo: string, hoje = hojeISO()): number | null {
  if (!prazo || !/^\d{4}-\d{2}-\d{2}$/.test(prazo)) return null;
  return diasEntre(hoje, prazo);
}

export function acaoEmAberto(a: Acao): boolean {
  return a.situacao !== 'Concluída' && a.situacao !== 'Suspensa';
}

export function acaoAtrasada(a: Acao, hoje = hojeISO()): boolean {
  const d = diasRestantes(a.prazo, hoje);
  return acaoEmAberto(a) && d !== null && d < 0;
}

/** Vigência do ato expirada (somente quando a vigência é uma data). */
export function vigenciaVencida(vigencia: string, hoje = hojeISO()): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(vigencia) && vigencia < hoje;
}

export function proximoId(prefixo: string, ids: string[], digitos = 3): string {
  const re = new RegExp(`^${prefixo}-(\\d+)$`);
  const max = ids.reduce((m, id) => {
    const r = re.exec(id);
    return r ? Math.max(m, Number(r[1])) : m;
  }, 0);
  return `${prefixo}-${String(max + 1).padStart(digitos, '0')}`;
}
