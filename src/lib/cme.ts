import dados from '../data/resolucoes-cme.json';
import type { Confianca } from './diario';

/** Resolução do Conselho Municipal de Educação de Belém (CME), publicada em https://www.cmebelem.com.br/resolucoes. */
export interface VinculoResolucao {
  id: string;
  inep: string;
  /** Papel da resolução para a unidade: autorização de funcionamento, renovação, prorrogação, credenciamento… */
  relacao: string;
  confianca: Confianca;
  nota?: string;
}

export interface ResolucaoCme {
  id: string;
  ano: number;
  /** Número como aparece no CME, ex.: "072". */
  numero: string;
  descricao: string;
  /** PDF no site do CME (não é copiado para o armazenamento do sistema). */
  url: string;
  unidades: VinculoResolucao[];
}

export const RESOLUCOES_CME = (dados as unknown as { resolucoes: ResolucaoCme[] }).resolucoes;

/** Página de resoluções do CME. */
export const PAINEL_CME = 'https://www.cmebelem.com.br/resolucoes';

/** "Resolução nº 072/2018 - CME" */
export const tituloResolucao = (r: Pick<ResolucaoCme, 'numero' | 'ano'>) => `Resolução nº ${r.numero}/${r.ano} - CME`;

/** Resoluções ligadas a uma unidade, da mais antiga para a mais recente. */
export function resolucoesDaUnidade(
  unidadeId: string,
  resolucoes: ResolucaoCme[] = RESOLUCOES_CME,
): { resolucao: ResolucaoCme; vinculo: VinculoResolucao }[] {
  return resolucoes
    .flatMap((resolucao) => resolucao.unidades.filter((v) => v.id === unidadeId).map((vinculo) => ({ resolucao, vinculo })))
    .sort((a, b) => a.resolucao.ano - b.resolucao.ano || a.resolucao.numero.localeCompare(b.resolucao.numero, 'pt-BR', { numeric: true }));
}
