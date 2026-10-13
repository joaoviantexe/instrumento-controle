import dados from '../data/resolucoes-cme.json';
import { chaveDe, situacaoDoVinculo, type Conferencia, type MapaConferencias, type SituacaoVinculo } from './conferencias';
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

/** Associação de uma resolução a uma unidade, com a situação depois da conferência. */
export interface ResolucaoDaUnidade {
  resolucao: ResolucaoCme;
  vinculo: VinculoResolucao;
  situacao: SituacaoVinculo;
  /** Decisão de quem conferiu (a observação própria dela, quando houver). */
  conferencia: Conferencia | undefined;
}

/** Resoluções ligadas a uma unidade, da mais antiga para a mais recente. As recusadas na conferência não aparecem. */
export function resolucoesDaUnidade(unidadeId: string, resolucoes: ResolucaoCme[] = RESOLUCOES_CME, conferencias?: MapaConferencias): ResolucaoDaUnidade[] {
  return resolucoes
    .flatMap((resolucao) =>
      resolucao.unidades
        .filter((v) => v.id === unidadeId)
        .map((vinculo) => ({
          resolucao,
          vinculo,
          situacao: situacaoDoVinculo(conferencias, 'cme', resolucao.id, vinculo.id, vinculo.confianca),
          conferencia: conferencias?.get(chaveDe({ fonte: 'cme', ato_id: resolucao.id, unidade_id: vinculo.id })),
        })),
    )
    .filter((x): x is ResolucaoDaUnidade => x.situacao !== 'recusado')
    .sort((a, b) => a.resolucao.ano - b.resolucao.ano || a.resolucao.numero.localeCompare(b.resolucao.numero, 'pt-BR', { numeric: true }));
}
