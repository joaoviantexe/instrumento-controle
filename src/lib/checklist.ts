/**
 * Checklist da Secretaria Escolar: a planilha que a secretaria da unidade preenche, uma aba por turma, com os 34 documentos
 * das seções 1 a 5 da Lista Mestra. Aqui ficam o modelo da checklist, a consolidação das turmas e o plano de aplicação
 * na Auditoria Documental. O que a secretaria declara entra na auditoria marcado como "requer verificação da CDE":
 * é uma autodeclaração, sem prova, e nunca substitui o que a CDE já avaliou.
 */
import { ITEM_POR_CODIGO, LISTA_MESTRA, SECOES } from '../data/planilha';
import { avaliacaoPadrao, avaliado } from './calc';
import { formatarData } from './format';
import { chaveTexto } from './panorama';
import type { Auditoria, Avaliacao, SituacaoItem } from './types';

/** Situações que a secretaria escolhe na planilha (a lista suspensa do modelo). */
export const SITUACOES_CHECKLIST: SituacaoItem[] = ['Conforme', 'Não conforme', 'Não se aplica', 'Não avaliado'];

/** Verificação da CDE sobre o que a secretaria declarou. */
export const VERIFICACAO_PENDENTE = 'Pendente';
export const VERIFICACAO_FEITA = 'Verificado';
export const ROTULO_VERIFICACAO: Record<string, string> = {
  [VERIFICACAO_PENDENTE]: 'Requer verificação da CDE',
  [VERIFICACAO_FEITA]: 'Verificado pela CDE',
};

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
}
export interface SecaoChecklist {
  titulo: string;
  secao: string;
  itens: ItemChecklist[];
}

export const SECOES_CHECKLIST: SecaoChecklist[] = TITULOS.map((titulo, i) => ({
  titulo,
  secao: SECOES[i],
  itens: LISTA_MESTRA.filter((x) => x.secao === SECOES[i]).map((x) => ({ codigo: x.codigo, rotulo: ROTULOS_MODELO[x.codigo] ?? x.item })),
}));
export const ITENS_CHECKLIST: ItemChecklist[] = SECOES_CHECKLIST.flatMap((s) => s.itens);
const CODIGOS = new Set(ITENS_CHECKLIST.map((i) => i.codigo));

/** Acha o item pelo texto da coluna A (nome do modelo ou da Lista Mestra, sem diferença de acentos e maiúsculas). */
const POR_ROTULO = new Map<string, string>(
  ITENS_CHECKLIST.flatMap((i) => [
    [chaveTexto(i.rotulo), i.codigo],
    [chaveTexto(ITEM_POR_CODIGO[i.codigo].item), i.codigo],
  ]),
);
export function itemPorRotulo(rotulo: string, secao?: number): string | null {
  const k = chaveTexto(rotulo);
  const codigo = POR_ROTULO.get(k);
  if (!codigo) return null;
  // "Relação nominal dos estudantes" e "Correspondências oficiais" existem em duas seções: vale a seção da linha.
  if (secao !== undefined) {
    const naSecao = SECOES_CHECKLIST[secao]?.itens.find((i) => chaveTexto(i.rotulo) === k || chaveTexto(ITEM_POR_CODIGO[i.codigo].item) === k);
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

/** A checklist de uma unidade em um ano (a última planilha enviada). */
export interface ChecklistUnidade {
  unidade_id: string;
  ano: number;
  /** Nome do arquivo enviado. */
  arquivo: string;
  /** Código da turma → respostas. */
  turmas: Record<string, RespostasTurma>;
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

/** Itens Não conforme ou Não avaliado de uma turma (o "itens pendentes" do título da aba). */
export function pendentesDaTurma(r: RespostasTurma | undefined): number {
  return ITENS_CHECKLIST.filter((i) => {
    const s = r?.[i.codigo]?.situacao ?? 'Não avaliado';
    return s === 'Não conforme' || s === 'Não avaliado';
  }).length;
}

export function resumirChecklist(c: Pick<ChecklistUnidade, 'turmas'>): { turmas: number; pendentes: number } {
  const turmas = Object.values(c.turmas);
  return { turmas: turmas.length, pendentes: turmas.reduce((s, t) => s + pendentesDaTurma(t), 0) };
}

// ---------------------------------------------------------------- consolidação das turmas

export interface Consolidado {
  codigo: string;
  /** Situação declarada para a unidade, juntando as turmas. */
  situacao: SituacaoItem;
  contagem: Record<SituacaoItem, number>;
  /** Turmas consideradas (as da checklist e as do panorama que ficaram sem resposta). */
  turmas: number;
  naoConformes: string[];
  semResposta: string[];
  observacoes: string[];
}

/**
 * Junta as respostas das turmas em uma situação por item:
 * todas Conforme → Conforme; nenhuma Conforme e alguma Não conforme → Não conforme; Conforme misturado com
 * Não conforme ou sem avaliação → Parcialmente conforme; todas Não se aplica → Não se aplica; nada declarado → Não avaliado.
 * Turmas do panorama ausentes da planilha contam como não avaliadas.
 */
export function consolidar(c: Pick<ChecklistUnidade, 'turmas'>, turmasEsperadas: string[] = []): Map<string, Consolidado> {
  const codigos = [...new Set([...Object.keys(c.turmas), ...turmasEsperadas])].sort();
  const mapa = new Map<string, Consolidado>();
  for (const item of ITENS_CHECKLIST) {
    const contagem = { Conforme: 0, 'Parcialmente conforme': 0, 'Não conforme': 0, 'Não se aplica': 0, 'Não avaliado': 0 } as Record<SituacaoItem, number>;
    const naoConformes: string[] = [];
    const semResposta: string[] = [];
    const observacoes: string[] = [];
    for (const t of codigos) {
      const r = c.turmas[t]?.[item.codigo];
      const s = r?.situacao ?? 'Não avaliado';
      contagem[s]++;
      if (s === 'Não conforme' || s === 'Parcialmente conforme') naoConformes.push(t);
      if (s === 'Não avaliado') semResposta.push(t);
      if (r?.observacao.trim()) observacoes.push(`${t}: ${r.observacao.trim()}`);
    }
    const c1 = contagem.Conforme;
    const nc = contagem['Não conforme'] + contagem['Parcialmente conforme'];
    const na = contagem['Não avaliado'];
    let situacao: SituacaoItem;
    if (!codigos.length || c1 + nc === 0) situacao = c1 + nc + na === 0 && codigos.length ? 'Não se aplica' : 'Não avaliado';
    else if (nc + na === 0) situacao = 'Conforme';
    else if (c1 === 0) situacao = 'Não conforme';
    else situacao = 'Parcialmente conforme';
    mapa.set(item.codigo, { codigo: item.codigo, situacao, contagem, turmas: codigos.length, naoConformes, semResposta, observacoes });
  }
  return mapa;
}

/** Frase que acompanha a declaração na auditoria. */
export function descreverDeclaracao(d: Consolidado, meta: { ano: number; arquivo: string; data: string }): string {
  const partes = [`Checklist da secretaria escolar (${meta.ano}), enviada em ${formatarData(meta.data)}`];
  const conformes = d.contagem.Conforme;
  if (d.turmas) partes.push(`Conforme em ${conformes} de ${d.turmas} turma(s)`);
  if (d.naoConformes.length) partes.push(`Não conforme: ${d.naoConformes.join(', ')}`);
  if (d.semResposta.length && d.situacao !== 'Não avaliado') partes.push(`sem avaliação: ${d.semResposta.join(', ')}`);
  if (d.observacoes.length) partes.push(`Observações: ${d.observacoes.slice(0, 5).join('; ')}${d.observacoes.length > 5 ? '…' : ''}`);
  return partes.join('. ') + '.';
}

// ---------------------------------------------------------------- aplicação na Auditoria Documental

export type AcaoItem =
  /** A situação declarada entra na auditoria, marcada para a CDE verificar. */
  | 'aplicar'
  /** A CDE já avaliou o item: a situação dela fica; a declaração é só registrada (e a diferença, apontada). */
  | 'manter'
  /** Nada muda. */
  | 'igual'
  /** A secretaria não avaliou o item em nenhuma turma. */
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

/** A CDE já avaliou (ou confirmou) o item: o que ela registrou prevalece sobre a autodeclaração. */
export function avaliadoPelaCde(av: Avaliacao): boolean {
  return avaliado(av.situacao) && av.verificacao !== VERIFICACAO_PENDENTE;
}

/** Item avaliado pela CDE com situação diferente da declarada pela secretaria. */
export function divergeDaDeclaracao(av: Avaliacao): boolean {
  return !!av.declarado && av.declarado !== 'Não avaliado' && avaliadoPelaCde(av) && av.declarado !== av.situacao;
}

export function planejarAplicacao(
  consolidados: Map<string, Consolidado>,
  auditoriaId: string,
  atuais: Map<string, Avaliacao> | undefined,
  meta: { ano: number; arquivo: string; data: string },
): MudancaItem[] {
  return ITENS_CHECKLIST.map((item) => {
    const declarado = consolidados.get(item.codigo)!;
    const antes = atuais?.get(item.codigo) ?? avaliacaoPadrao(auditoriaId, item.codigo);
    const base = { codigo: item.codigo, rotulo: item.rotulo, antes, declarado };
    if (declarado.situacao === 'Não avaliado') return { ...base, acao: 'sem-declaracao', depois: antes, diverge: false };
    const declaracao = descreverDeclaracao(declarado, meta);
    if (avaliadoPelaCde(antes)) {
      const depois = { ...antes, declarado: declarado.situacao, declaracao };
      const diverge = declarado.situacao !== antes.situacao;
      const mudou = antes.declarado !== depois.declarado || antes.declaracao !== depois.declaracao;
      return { ...base, acao: mudou ? 'manter' : 'igual', depois, diverge };
    }
    const depois: Avaliacao = { ...antes, situacao: declarado.situacao, declarado: declarado.situacao, declaracao, verificacao: VERIFICACAO_PENDENTE };
    const igual = antes.situacao === depois.situacao && antes.verificacao === VERIFICACAO_PENDENTE && antes.declarado === depois.declarado;
    // Mesmo sem mudar a situação, a frase (turmas, data) é atualizada.
    return { ...base, acao: igual ? 'igual' : 'aplicar', depois, diverge: false };
  });
}

/** Registros que precisam ser gravados (inclui os "iguais" cuja frase da declaração mudou). */
export function registrosDaAplicacao(mudancas: MudancaItem[]): Avaliacao[] {
  return mudancas.filter((m) => m.acao !== 'sem-declaracao' && JSON.stringify(m.antes) !== JSON.stringify(m.depois)).map((m) => m.depois);
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

/**
 * Respostas da planilha "com dados": a situação atual de cada documento em cada turma.
 * O que a CDE avaliou ou verificou vale para todas as turmas (a auditoria tem uma situação por documento para a unidade),
 * a não ser que as respostas da secretaria por turma já resultem na mesma situação (aí o detalhe por turma é mantido).
 * Onde a CDE ainda não avaliou, ficam as últimas respostas da secretaria.
 */
export function respostasComDados(
  turmas: string[],
  salvas: Record<string, RespostasTurma> | undefined,
  avaliacoes: Map<string, Avaliacao> | undefined,
): Record<string, RespostasTurma> {
  const base = salvas ?? {};
  const consolidadas = consolidar({ turmas: base }, turmas);
  const saida: Record<string, RespostasTurma> = Object.fromEntries(turmas.map((t) => [t, { ...base[t] }]));
  for (const item of ITENS_CHECKLIST) {
    const av = avaliacoes?.get(item.codigo);
    if (!av || !avaliadoPelaCde(av)) continue;
    if (Object.keys(base).length && consolidadas.get(item.codigo)?.situacao === av.situacao) continue;
    const marca = av.verificacao === VERIFICACAO_FEITA ? MARCA_VERIFICADO : MARCA_CDE;
    for (const t of turmas) {
      const antes = saida[t][item.codigo] ?? respostaVazia();
      saida[t][item.codigo] = { ...antes, situacao: av.situacao, observacao: antes.observacao && !ehMarcaCde(antes.observacao) ? antes.observacao : marca };
    }
  }
  return saida;
}
