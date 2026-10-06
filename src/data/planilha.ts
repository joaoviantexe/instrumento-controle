import bruto from './planilha.json';
import type { Auditoria, ItemLista, SituacaoItem, Unidade } from '../lib/types';

/**
 * Textos, listas e registros extraídos da planilha
 * "Instrumento_Controle_Documentacao_Escolar_CDE_SEMEC.xlsx" por scripts/extrair_planilha.py.
 * Os textos são idênticos aos das células de origem.
 */
export const PLANILHA = bruto;
export const TEXTOS = bruto.textos;

export const LISTA_MESTRA: ItemLista[] = bruto.listaMestra;
export const UNIDADES_INICIAIS: Unidade[] = bruto.unidades;
export const AUDITORIAS_INICIAIS: Auditoria[] = bruto.auditorias;

export const SITUACOES_ITEM = TEXTOS.auditoriaDocumental.situacoes as SituacaoItem[];
export const SIM_NAO = TEXTOS.auditoriaDocumental.requerAcao;
export const SITUACOES_ACAO = TEXTOS.planoAcao.situacoes;
export const PRIORIDADES = TEXTOS.planoAcao.prioridades;
export const VALIDACOES = TEXTOS.planoAcao.validacoes;
export const SITUACOES_AUDITORIA = TEXTOS.planoAuditoria.situacoes;
export const TIPOS_VERIFICACAO = TEXTOS.planoAuditoria.tipos;
export const SITUACOES_UNIDADE = TEXTOS.cadastro.situacoes;
export const DISTRITOS = TEXTOS.dashboard.distritos;

/** Seções na ordem da Lista Mestra. */
export const SECOES: string[] = Array.from(new Set(LISTA_MESTRA.map((i) => i.secao)));
export const SECAO_VISITA = SECOES[SECOES.length - 1]; // "7. Checklist da visita"
export const SECOES_CURTAS: Record<string, string> = Object.fromEntries(
  SECOES.map((s, i) => [s, TEXTOS.dashboard.secoesCurtas[i] ?? s]),
);

export const ITEM_POR_CODIGO: Record<string, ItemLista> = Object.fromEntries(
  LISTA_MESTRA.map((i) => [i.codigo, i]),
);
export const ITENS_VISITA = LISTA_MESTRA.filter((i) => i.secao === SECAO_VISITA);
export const ITENS_TECNICOS = LISTA_MESTRA.filter((i) => i.peso > 0);

/** Valores já usados na planilha, oferecidos como opções nos formulários do cadastro. */
function distintos(campo: keyof Unidade): string[] {
  return Array.from(new Set(UNIDADES_INICIAIS.map((u) => String(u[campo]))))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
export const OPCOES_CADASTRO = {
  rede: distintos('rede'),
  tipo_unidade: distintos('tipo_unidade'),
  tipo_predio: distintos('tipo_predio'),
  tipo_contrato: distintos('tipo_contrato'),
  zona: distintos('zona'),
  distrito_anexo: distintos('distrito_anexo'),
  bairro: distintos('bairro'),
};

export const CABECALHOS_UNIDADE = TEXTOS.cadastro.cabecalhos as Record<keyof Omit<Unidade, 'id'>, string>;
export const CABECALHOS_LISTA = TEXTOS.listaMestra.cabecalhos as Record<keyof ItemLista, string>;

/** Cabeçalhos da Auditoria Documental indexados pelo campo correspondente. */
const ad = TEXTOS.auditoriaDocumental.cabecalhos;
export const ROTULOS_AUDITORIA_DOC = {
  id: ad[0],
  data: ad[1],
  unidade: ad[2],
  distrito: ad[3],
  auditor: ad[4],
  bairro: ad[5],
  secao: ad[6],
  item: ad[7],
  evidenciaEsperada: ad[8],
  peso: ad[9],
  situacao: ad[10],
  evidencia: ad[11],
  pesoAplicavel: ad[12],
  pontos: ad[13],
  indiceItem: ad[14],
  achado: ad[15],
  requerAcao: ad[16],
  prazo: ad[17],
  responsavel: ad[18],
  situacaoAcao: ad[19],
};

const pa = TEXTOS.planoAuditoria.cabecalhos;
export const ROTULOS_PLANO = {
  id: pa[0],
  unidade: pa[1],
  distrito: pa[2],
  tipo: pa[3],
  prioridade: pa[4],
  dataPlanejada: pa[5],
  dataRealizada: pa[6],
  equipe: pa[7],
  situacao: pa[8],
  previstos: pa[9],
  avaliados: pa[10],
  indice: pa[11],
  ncCriticas: pa[12],
  checklist: pa[13],
  observacoes: pa[14],
};

const ac = TEXTOS.planoAcao.cabecalhos;
export const ROTULOS_ACAO = {
  id: ac[0],
  auditoria: ac[1],
  unidade: ac[2],
  item: ac[3],
  achado: ac[4],
  acao: ac[5],
  prioridade: ac[6],
  responsavel: ac[7],
  dataAbertura: ac[8],
  prazo: ac[9],
  diasRestantes: ac[10],
  situacao: ac[11],
  evidencia: ac[12],
  dataConclusao: ac[13],
  validacao: ac[14],
};
