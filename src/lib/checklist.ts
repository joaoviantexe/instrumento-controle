/**
 * Checklist da Secretaria Escolar: a planilha que a secretaria da unidade preenche com os 34 documentos das seções 1 a 5
 * da Lista Mestra. Os documentos da unidade (ato de criação, regimento, servidores…) ficam numa aba geral; os que se
 * conferem em cada turma (documentos dos alunos e a relação nominal) ficam numa aba por turma.
 *
 * Aqui ficam o modelo da checklist, a consolidação das turmas e o plano de aplicação na Auditoria Documental. O que a
 * secretaria declara entra na auditoria marcado como "requer verificação da CDE": é uma autodeclaração, sem prova, e
 * nunca substitui o que a CDE já avaliou.
 */
import { ITEM_POR_CODIGO, LISTA_MESTRA, SECOES } from '../data/planilha';
import { avaliacaoPadrao, avaliado } from './calc';
import { formatarData } from './format';
import { chaveTexto } from './panorama';
import type { Auditoria, Avaliacao, AvaliacaoTurma, SituacaoItem } from './types';

/** Situações que a secretaria escolhe na planilha (a lista suspensa do modelo). */
export const SITUACOES_CHECKLIST: SituacaoItem[] = ['Conforme', 'Não conforme', 'Não se aplica', 'Não avaliado'];

/** Verificação da CDE sobre o que a secretaria declarou. */
export const VERIFICACAO_PENDENTE = 'Pendente';
export const VERIFICACAO_FEITA = 'Verificado';
export const ROTULO_VERIFICACAO: Record<string, string> = {
  [VERIFICACAO_PENDENTE]: 'Requer verificação da CDE',
  [VERIFICACAO_FEITA]: 'Verificado pela CDE',
};

/**
 * Itens conferidos em cada turma: a relação nominal dos estudantes da turma e os documentos dos alunos (seção 3).
 * Todos os outros (atos, regimento, PPP, livros, servidores, censo…) são da unidade inteira.
 */
export const ITENS_POR_TURMA = ['SEC-06', 'EST-01', 'EST-02', 'EST-03', 'EST-04', 'EST-05', 'EST-06', 'EST-07', 'EST-08', 'EST-09'];
const POR_TURMA = new Set(ITENS_POR_TURMA);
export const ehPorTurma = (codigo: string) => POR_TURMA.has(codigo);

/** Títulos das seções na planilha da secretaria (seções 1 a 5 da Lista Mestra). */
const TITULOS = [
  'Checagem de Documentos Institucionais',
  'Checagem de Documentos de Secretaria Escolar',
  'Checagem de Documentos dos Alunos',
  'Checagem de Documentos dos Servidores',
  'Checagem de Documentos dos Administrativos',
];
/** Nomes que a planilha da secretaria usa no lugar dos da Lista Mestra. */
const ROTULOS_MODELO: Record<string, string> = {
  'SEC-01': 'Livro/Pasta de Matrícula dos Alunos',
  'EST-03': 'Pasta Individual',
};

export interface ItemChecklist {
  codigo: string;
  rotulo: string;
  porTurma: boolean;
}
export interface SecaoChecklist {
  titulo: string;
  secao: string;
  itens: ItemChecklist[];
}

export const SECOES_CHECKLIST: SecaoChecklist[] = TITULOS.map((titulo, i) => ({
  titulo,
  secao: SECOES[i],
  itens: LISTA_MESTRA.filter((x) => x.secao === SECOES[i]).map((x) => ({ codigo: x.codigo, rotulo: ROTULOS_MODELO[x.codigo] ?? x.item, porTurma: POR_TURMA.has(x.codigo) })),
}));
export const ITENS_CHECKLIST: ItemChecklist[] = SECOES_CHECKLIST.flatMap((s) => s.itens);
const CODIGOS = new Set(ITENS_CHECKLIST.map((i) => i.codigo));

const filtrarSecoes = (f: (i: ItemChecklist) => boolean) => SECOES_CHECKLIST.map((s) => ({ ...s, itens: s.itens.filter(f) })).filter((s) => s.itens.length);
/** Seções da aba geral (itens da unidade). */
export const SECOES_GERAL = filtrarSecoes((i) => !i.porTurma);
/** Seções de cada aba de turma. */
export const SECOES_TURMA = filtrarSecoes((i) => i.porTurma);
/** Itens tratados na aba geral: sem turmas no panorama, todos. */
export const itensGerais = (comTurmas: boolean) => ITENS_CHECKLIST.filter((i) => !comTurmas || !i.porTurma);

/** Acha o item pelo texto da coluna A (nome do modelo ou da Lista Mestra, sem diferença de acentos e maiúsculas). */
const POR_ROTULO = new Map<string, string>(
  ITENS_CHECKLIST.flatMap((i) => [
    [chaveTexto(i.rotulo), i.codigo],
    [chaveTexto(ITEM_POR_CODIGO[i.codigo].item), i.codigo],
  ]),
);
/** `secao` é o título da seção da linha (desempata itens com o mesmo nome em duas seções). */
export function itemPorRotulo(rotulo: string, secao?: string): string | null {
  const k = chaveTexto(rotulo);
  const codigo = POR_ROTULO.get(k);
  if (!codigo) return null;
  // "Relação nominal dos estudantes" e "Correspondências oficiais" existem em duas seções: vale a seção da linha.
  if (secao !== undefined) {
    const s = SECOES_CHECKLIST.find((x) => chaveTexto(x.titulo) === chaveTexto(secao));
    const naSecao = s?.itens.find((i) => chaveTexto(i.rotulo) === k || chaveTexto(ITEM_POR_CODIGO[i.codigo].item) === k);
    if (naSecao) return naSecao.codigo;
  }
  return codigo;
}
export const ehItemChecklist = (codigo: string) => CODIGOS.has(codigo);

/** Situação escrita de qualquer jeito ("conforme", "NÃO CONFORME", "N/A") → situação do sistema. */
export function lerSituacao(v: string): SituacaoItem | null {
  const k = chaveTexto(v);
  if (!k) return 'Não avaliado';
  if (k === 'conforme' || k === 'c' || k === 'sim' || k === 'ok') return 'Conforme';
  if (k === 'nao conforme' || k === 'nc' || k === 'nao') return 'Não conforme';
  if (k === 'parcialmente conforme' || k === 'parcial') return 'Parcialmente conforme';
  if (k === 'nao se aplica' || k === 'n a' || k === 'na' || k === 'nsa') return 'Não se aplica';
  if (k === 'nao avaliado' || k === 'pendente') return 'Não avaliado';
  return null;
}

/**
 * Situação de um item a partir das turmas:
 * alguma Não conforme ou parcial → Não conforme (se nenhuma estiver conforme) ou Parcialmente conforme;
 * senão, alguma ainda não avaliada → Não avaliado (conformidade só depois de conferir todas);
 * senão, alguma Conforme → Conforme; todas Não se aplica → Não se aplica.
 */
export function consolidarSituacoes(lista: SituacaoItem[]): SituacaoItem {
  const n = (s: SituacaoItem) => lista.filter((x) => x === s).length;
  const conformes = n('Conforme');
  const parciais = n('Parcialmente conforme');
  if (n('Não conforme') + parciais > 0) return conformes + parciais > 0 ? 'Parcialmente conforme' : 'Não conforme';
  if (!lista.length || n('Não avaliado') > 0) return 'Não avaliado';
  return conformes > 0 ? 'Conforme' : 'Não se aplica';
}

// ---------------------------------------------------------------- respostas guardadas

export interface RespostaItem {
  situacao: SituacaoItem;
  /** Última atualização informada (AAAA-MM-DD ou texto). */
  atualizado: string;
  prazo: string;
  responsavel: string;
  observacao: string;
}
/** Código do item → resposta. */
export type RespostasTurma = Record<string, RespostaItem>;

/** Respostas de uma planilha: a aba geral e uma por turma. */
export interface RespostasChecklist {
  /** Itens da unidade (aba "Checklist - Geral"). */
  geral: RespostasTurma;
  /** Código da turma → respostas dos itens por turma. */
  turmas: Record<string, RespostasTurma>;
}

/** A checklist de uma unidade em um ano (a última planilha enviada). */
export interface ChecklistUnidade extends RespostasChecklist {
  unidade_id: string;
  ano: number;
  /** Nome do arquivo enviado. */
  arquivo: string;
  atualizado_em: string;
  atualizado_por: string;
}

/** Resumo para listas (sem as respostas). */
export interface InfoChecklist {
  unidade_id: string;
  ano: number;
  arquivo: string;
  turmas: number;
  pendentes: number;
  atualizado_em: string;
  atualizado_por: string;
}

export const respostaVazia = (): RespostaItem => ({ situacao: 'Não avaliado', atualizado: '', prazo: '', responsavel: '', observacao: '' });

const pendente = (s: SituacaoItem | undefined) => !s || s === 'Não conforme' || s === 'Não avaliado';

/** Itens por turma Não conforme ou Não avaliado de uma turma (o "itens pendentes" do título da aba). */
export function pendentesDaTurma(r: RespostasTurma | undefined): number {
  return ITENS_POR_TURMA.filter((c) => pendente(r?.[c]?.situacao)).length;
}

/** Pendências da aba geral (sem turmas, ela tem todos os itens). */
export function pendentesGerais(r: RespostasTurma | undefined, comTurmas = true): number {
  return itensGerais(comTurmas).filter((i) => pendente(r?.[i.codigo]?.situacao)).length;
}

export function resumirChecklist(c: RespostasChecklist): { turmas: number; pendentes: number } {
  const turmas = Object.values(c.turmas);
  return { turmas: turmas.length, pendentes: pendentesGerais(c.geral, turmas.length > 0) + turmas.reduce((s, t) => s + pendentesDaTurma(t), 0) };
}

/**
 * Junta as respostas das turmas de um item da unidade numa resposta só (planilhas antigas, com todos os itens em cada
 * turma). O documento é o mesmo para a escola toda: valem as turmas em que a secretaria respondeu.
 */
export function juntarRespostas(porTurma: [string, RespostaItem][]): RespostaItem | null {
  const preenchidas = porTurma.filter(([, r]) => r.situacao !== 'Não avaliado' || r.observacao || r.atualizado || r.prazo);
  if (!preenchidas.length) return null;
  const obs = porTurma.filter(([, r]) => r.observacao).map(([t, r]) => `${t}: ${r.observacao}`);
  const respondidas = porTurma.map(([, r]) => r.situacao).filter((x) => x !== 'Não avaliado');
  return {
    situacao: consolidarSituacoes(respondidas),
    atualizado: preenchidas.map(([, r]) => r.atualizado).filter(Boolean).sort().pop() ?? '',
    prazo: preenchidas.map(([, r]) => r.prazo).find(Boolean) ?? '',
    responsavel: preenchidas.map(([, r]) => r.responsavel).find(Boolean) ?? '',
    observacao: obs.slice(0, 5).join('; ') + (obs.length > 5 ? '…' : ''),
  };
}

/** Checklists salvas antes da aba geral (todos os itens em cada turma): os itens gerais passam para a aba geral. */
export function comGeral<T extends { turmas: Record<string, RespostasTurma>; geral?: RespostasTurma }>(c: T): T & RespostasChecklist {
  if (c.geral) return c as T & RespostasChecklist;
  const geral: RespostasTurma = {};
  const turmas: Record<string, RespostasTurma> = {};
  const legado = Object.entries(c.turmas);
  for (const [t, r] of legado) turmas[t] = Object.fromEntries(Object.entries(r).filter(([codigo]) => ehPorTurma(codigo)));
  for (const item of itensGerais(true)) {
    const junta = juntarRespostas(legado.filter(([, r]) => r[item.codigo]).map(([t, r]) => [t, r[item.codigo]]));
    if (junta) geral[item.codigo] = junta;
  }
  return { ...c, geral, turmas };
}

// ---------------------------------------------------------------- consolidação para exibição

export interface Consolidado {
  codigo: string;
  /** Situação declarada para a unidade (nos itens por turma, juntando as turmas). */
  situacao: SituacaoItem;
  /** Item conferido turma a turma (com turmas no panorama). */
  porTurma: boolean;
  contagem: Record<SituacaoItem, number>;
  /** Turmas consideradas (as da checklist e as do panorama que ficaram sem resposta). */
  turmas: number;
  naoConformes: string[];
  semResposta: string[];
  observacoes: string[];
}

const contagemVazia = () => ({ Conforme: 0, 'Parcialmente conforme': 0, 'Não conforme': 0, 'Não se aplica': 0, 'Não avaliado': 0 }) as Record<SituacaoItem, number>;

/** Situação declarada de cada item: o da aba geral, ou o das turmas juntas (as do panorama sem aba contam como não avaliadas). */
export function consolidar(c: RespostasChecklist, turmasEsperadas: string[] = []): Map<string, Consolidado> {
  const codigos = [...new Set([...Object.keys(c.turmas), ...turmasEsperadas])].sort();
  const mapa = new Map<string, Consolidado>();
  for (const item of ITENS_CHECKLIST) {
    const contagem = contagemVazia();
    if (!item.porTurma || !codigos.length) {
      const r = c.geral[item.codigo];
      const situacao = r?.situacao ?? 'Não avaliado';
      contagem[situacao]++;
      mapa.set(item.codigo, { codigo: item.codigo, situacao, porTurma: false, contagem, turmas: 0, naoConformes: [], semResposta: [], observacoes: r?.observacao ? [r.observacao] : [] });
      continue;
    }
    const naoConformes: string[] = [];
    const semResposta: string[] = [];
    const observacoes: string[] = [];
    const sits = codigos.map((t) => {
      const r = c.turmas[t]?.[item.codigo];
      const s = r?.situacao ?? 'Não avaliado';
      contagem[s]++;
      if (s === 'Não conforme' || s === 'Parcialmente conforme') naoConformes.push(t);
      if (s === 'Não avaliado') semResposta.push(t);
      if (r?.observacao.trim()) observacoes.push(`${t}: ${r.observacao.trim()}`);
      return s;
    });
    mapa.set(item.codigo, { codigo: item.codigo, situacao: consolidarSituacoes(sits), porTurma: true, contagem, turmas: codigos.length, naoConformes, semResposta, observacoes });
  }
  return mapa;
}

/** Frase que acompanha a declaração de um item da unidade na auditoria. */
export function descreverDeclaracao(d: Consolidado, meta: { ano: number; arquivo: string; data: string }): string {
  const partes = [`Checklist da secretaria escolar (${meta.ano}), enviada em ${formatarData(meta.data)}`];
  if (d.porTurma && d.turmas) {
    partes.push(`Conforme em ${d.contagem.Conforme} de ${d.turmas} turma(s)`);
    if (d.naoConformes.length) partes.push(`Não conforme: ${d.naoConformes.join(', ')}`);
  }
  if (d.observacoes.length) partes.push(`Observações: ${d.observacoes.slice(0, 5).join('; ')}${d.observacoes.length > 5 ? '…' : ''}`);
  return partes.join('. ') + '.';
}

// ---------------------------------------------------------------- avaliação por turma

export const avaliacaoTurmaPadrao = (auditoria_id: string, item: string, turma: string): AvaliacaoTurma => ({
  auditoria_id,
  item,
  turma,
  situacao: 'Não avaliado',
  observacao: '',
  verificacao: '',
  declarado: '',
});

/** Turmas de cada item de uma auditoria: item → turma → avaliação. */
export type MapaTurmas = Map<string, Map<string, Map<string, AvaliacaoTurma>>>;
export function indexarTurmas(lista: AvaliacaoTurma[]): MapaTurmas {
  const m: MapaTurmas = new Map();
  for (const a of lista) {
    let porItem = m.get(a.auditoria_id);
    if (!porItem) m.set(a.auditoria_id, (porItem = new Map()));
    let porTurma = porItem.get(a.item);
    if (!porTurma) porItem.set(a.item, (porTurma = new Map()));
    porTurma.set(a.turma, a);
  }
  return m;
}

/**
 * Situação do item na auditoria a partir das turmas (as turmas sem registro contam como não avaliadas). A verificação
 * fica pendente enquanto alguma turma autodeclarada não for conferida.
 */
export function itemDasTurmas(base: Avaliacao, registros: AvaliacaoTurma[], turmas: string[]): Avaliacao {
  if (!registros.length) return base;
  const codigos = [...new Set([...turmas, ...registros.map((r) => r.turma)])].sort();
  const por = new Map(registros.map((r) => [r.turma, r]));
  const situacao = consolidarSituacoes(codigos.map((t) => por.get(t)?.situacao ?? 'Não avaliado'));
  const verificacao = registros.some((r) => r.verificacao === VERIFICACAO_PENDENTE)
    ? VERIFICACAO_PENDENTE
    : registros.some((r) => r.verificacao === VERIFICACAO_FEITA)
      ? VERIFICACAO_FEITA
      : '';
  const declarados = registros.filter((r) => r.declarado && r.declarado !== 'Não avaliado');
  if (!declarados.length) return { ...base, situacao, verificacao };
  const sit = (s: SituacaoItem) => codigos.filter((t) => (por.get(t)?.declarado || 'Não avaliado') === s);
  const naoConformes = [...sit('Não conforme'), ...sit('Parcialmente conforme')];
  const declaracao =
    `Declarado pela secretaria escolar, por turma: Conforme em ${sit('Conforme').length} de ${codigos.length}` +
    (naoConformes.length ? `; Não conforme: ${naoConformes.join(', ')}` : '') +
    (sit('Não avaliado').length ? `; sem declaração: ${sit('Não avaliado').length} turma(s)` : '') +
    '.';
  return {
    ...base,
    situacao,
    verificacao,
    declarado: consolidarSituacoes(codigos.map((t) => (por.get(t)?.declarado || 'Não avaliado') as SituacaoItem)),
    declaracao,
  };
}

// ---------------------------------------------------------------- aplicação na Auditoria Documental

export type AcaoItem =
  /** A situação declarada entra na auditoria, marcada para a CDE verificar. */
  | 'aplicar'
  /** A CDE já avaliou: a situação dela fica; a declaração é só registrada (e a diferença, apontada). */
  | 'manter'
  /** Nada muda. */
  | 'igual'
  /** A secretaria não avaliou. */
  | 'sem-declaracao';

export interface MudancaItem {
  codigo: string;
  rotulo: string;
  acao: AcaoItem;
  antes: Avaliacao;
  depois: Avaliacao;
  declarado: Consolidado;
  /** A CDE avaliou diferente do que a secretaria declara. */
  diverge: boolean;
}

export interface MudancaTurma {
  codigo: string;
  turma: string;
  acao: AcaoItem;
  antes: AvaliacaoTurma;
  depois: AvaliacaoTurma;
  diverge: boolean;
}

export interface PlanoAplicacao {
  /** Itens da unidade (e, sem turmas no panorama, todos). */
  itens: MudancaItem[];
  /** Itens por turma, turma a turma. */
  turmas: MudancaTurma[];
}

type ComSituacao = { situacao: string; verificacao?: string; declarado?: string };

/** A CDE já avaliou (ou confirmou): o que ela registrou prevalece sobre a autodeclaração. */
export function avaliadoPelaCde(av: ComSituacao): boolean {
  return avaliado(av.situacao) && av.verificacao !== VERIFICACAO_PENDENTE;
}

/** Avaliado pela CDE com situação diferente da declarada pela secretaria. */
export function divergeDaDeclaracao(av: ComSituacao): boolean {
  return !!av.declarado && av.declarado !== 'Não avaliado' && avaliadoPelaCde(av) && av.declarado !== av.situacao;
}

export function planejarAplicacao(
  c: RespostasChecklist,
  auditoriaId: string,
  atuais: Map<string, Avaliacao> | undefined,
  atuaisTurma: Map<string, Map<string, AvaliacaoTurma>> | undefined,
  turmasEsperadas: string[],
  meta: { ano: number; arquivo: string; data: string },
): PlanoAplicacao {
  const codigosTurma = [...new Set([...Object.keys(c.turmas), ...turmasEsperadas])].sort();
  const consolidados = consolidar(c, turmasEsperadas);
  const plano: PlanoAplicacao = { itens: [], turmas: [] };
  for (const item of ITENS_CHECKLIST) {
    if (item.porTurma && codigosTurma.length) {
      for (const turma of codigosTurma) {
        const r = c.turmas[turma]?.[item.codigo];
        const s = r?.situacao ?? 'Não avaliado';
        const antes = atuaisTurma?.get(item.codigo)?.get(turma) ?? avaliacaoTurmaPadrao(auditoriaId, item.codigo, turma);
        const base = { codigo: item.codigo, turma, antes };
        if (s === 'Não avaliado') plano.turmas.push({ ...base, acao: 'sem-declaracao', depois: antes, diverge: false });
        else if (avaliadoPelaCde(antes)) {
          const depois = { ...antes, declarado: s };
          plano.turmas.push({ ...base, acao: antes.declarado === s ? 'igual' : 'manter', depois, diverge: s !== antes.situacao });
        } else {
          const depois: AvaliacaoTurma = { ...antes, situacao: s, declarado: s, verificacao: VERIFICACAO_PENDENTE, observacao: r?.observacao || antes.observacao };
          const igual = JSON.stringify(antes) === JSON.stringify(depois);
          plano.turmas.push({ ...base, acao: igual ? 'igual' : 'aplicar', depois, diverge: false });
        }
      }
      continue;
    }
    const declarado = consolidados.get(item.codigo)!;
    const antes = atuais?.get(item.codigo) ?? avaliacaoPadrao(auditoriaId, item.codigo);
    const base = { codigo: item.codigo, rotulo: item.rotulo, antes, declarado };
    if (declarado.situacao === 'Não avaliado') {
      plano.itens.push({ ...base, acao: 'sem-declaracao', depois: antes, diverge: false });
      continue;
    }
    const declaracao = descreverDeclaracao(declarado, meta);
    if (avaliadoPelaCde(antes)) {
      const depois = { ...antes, declarado: declarado.situacao, declaracao };
      const mudou = antes.declarado !== depois.declarado || antes.declaracao !== depois.declaracao;
      plano.itens.push({ ...base, acao: mudou ? 'manter' : 'igual', depois, diverge: declarado.situacao !== antes.situacao });
      continue;
    }
    const depois: Avaliacao = { ...antes, situacao: declarado.situacao, declarado: declarado.situacao, declaracao, verificacao: VERIFICACAO_PENDENTE };
    const igual = antes.situacao === depois.situacao && antes.verificacao === VERIFICACAO_PENDENTE && antes.declarado === depois.declarado;
    // Mesmo sem mudar a situação, a frase (data, observações) é atualizada.
    plano.itens.push({ ...base, acao: igual ? 'igual' : 'aplicar', depois, diverge: false });
  }
  return plano;
}

/** Registros que precisam ser gravados (inclui os "iguais" cuja frase da declaração mudou). */
export function registrosDaAplicacao(p: PlanoAplicacao): { itens: Avaliacao[]; turmas: AvaliacaoTurma[] } {
  const mudou = (m: { acao: AcaoItem; antes: object; depois: object }) => m.acao !== 'sem-declaracao' && JSON.stringify(m.antes) !== JSON.stringify(m.depois);
  return { itens: p.itens.filter(mudou).map((m) => m.depois), turmas: p.turmas.filter(mudou).map((m) => m.depois) };
}

// ---------------------------------------------------------------- planilha "com dados"

/** Observação escrita nas células que a CDE já avaliou (a leitura a ignora: não é declaração da secretaria). */
export const MARCA_CDE = 'Avaliado pela CDE';
export const MARCA_VERIFICADO = 'Verificado pela CDE';
export const ehMarcaCde = (obs: string) => [MARCA_CDE, MARCA_VERIFICADO].some((m) => chaveTexto(m) === chaveTexto(obs));

/** Auditoria que representa a unidade: a mais recente com itens avaliados, ou a mais recente. */
export function auditoriaDeReferencia<T extends Pick<Auditoria, 'id' | 'unidade_id' | 'iniciada'>>(auditorias: T[], unidadeId: string): T | undefined {
  return auditorias
    .filter((a) => a.unidade_id === unidadeId)
    .sort((a, b) => Number(b.iniciada) - Number(a.iniciada) || b.id.localeCompare(a.id))[0];
}

/** Resposta com a situação da CDE e a marca na observação (a observação da secretaria, se houver, fica). */
function comCde(antes: RespostaItem | undefined, av: ComSituacao): RespostaItem {
  const r = antes ?? respostaVazia();
  const marca = av.verificacao === VERIFICACAO_FEITA ? MARCA_VERIFICADO : MARCA_CDE;
  return { ...r, situacao: av.situacao as SituacaoItem, observacao: r.observacao && !ehMarcaCde(r.observacao) ? r.observacao : marca };
}

/**
 * Respostas da planilha "com dados": a situação atual de cada documento. Onde a CDE avaliou (o item da unidade, ou o
 * item em cada turma), vale a avaliação dela; onde ainda não avaliou, a última resposta da secretaria.
 */
export function respostasComDados(
  turmas: string[],
  salvas: RespostasChecklist | undefined,
  avaliacoes: Map<string, Avaliacao> | undefined,
  avaliacoesTurma: Map<string, Map<string, AvaliacaoTurma>> | undefined,
): RespostasChecklist {
  const geral: RespostasTurma = { ...salvas?.geral };
  const porTurma: Record<string, RespostasTurma> = Object.fromEntries(turmas.map((t) => [t, { ...salvas?.turmas[t] }]));
  for (const item of ITENS_CHECKLIST) {
    const av = avaliacoes?.get(item.codigo);
    if (!item.porTurma || !turmas.length) {
      if (av && avaliadoPelaCde(av)) geral[item.codigo] = comCde(geral[item.codigo], av);
      continue;
    }
    const registros = avaliacoesTurma?.get(item.codigo);
    for (const t of turmas) {
      const rt = registros?.get(t);
      if (rt && avaliadoPelaCde(rt)) porTurma[t][item.codigo] = comCde(porTurma[t][item.codigo], rt);
      // Avaliado só para a unidade inteira (antes da avaliação por turma): vale para todas as turmas.
      else if (!registros?.size && av && avaliadoPelaCde(av)) porTurma[t][item.codigo] = comCde(porTurma[t][item.codigo], av);
    }
  }
  return { geral, turmas: porTurma };
}
