import dados from '../data/atos-sem-unidade.json';
import { linkDiario, referenciaDiario, type PublicacaoDiario } from './diario';

/** Ato achado no CME ou no Diário Oficial que não casa com nenhuma unidade do cadastro (ou que pede leitura do original). */
export interface AtoSemUnidade {
  id: string;
  fonte: 'cme' | 'diario';
  titulo: string;
  descricao: string;
  /** PDF no site do CME. */
  url?: string;
  publicacao?: PublicacaoDiario;
  referencia?: string;
  /** Por que está aqui e o que fazer. */
  motivo: string;
}

export const ATOS_SEM_UNIDADE = (dados as unknown as { itens: AtoSemUnidade[] }).itens;

/** Link que abre o PDF do CME ou a edição do Diário na página do ato; nulo se ainda não houver como abrir. */
export const linkDoAto = (a: AtoSemUnidade, base?: string): string | null => a.url ?? (a.publicacao ? linkDiario(a.publicacao, base) : null);

/** "Site do CME" ou "DOM nº 15.217, de 25/06/2025, p. 2–3". */
export const referenciaDoAto = (a: AtoSemUnidade): string => (a.publicacao ? referenciaDiario(a.publicacao) : (a.referencia ?? ''));
