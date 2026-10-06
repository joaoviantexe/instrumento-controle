import type { Acao, Auditoria, Avaliacao, Snapshot, Unidade } from '../types';

export interface Tabelas {
  unidades: Unidade;
  auditorias: Auditoria;
  avaliacoes: Avaliacao;
  acoes: Acao;
}
export type NomeTabela = keyof Tabelas;

/** Chave primária de cada tabela. */
export const CHAVES: { [T in NomeTabela]: (keyof Tabelas[T])[] } = {
  unidades: ['id'],
  auditorias: ['id'],
  avaliacoes: ['auditoria_id', 'item'],
  acoes: ['id'],
};

export interface Backend {
  modo: 'local' | 'supabase';
  carregar(): Promise<Snapshot>;
  /** Insere ou atualiza. */
  salvar<T extends NomeTabela>(tabela: T, registro: Tabelas[T]): Promise<void>;
  /** Insere ou atualiza vários registros de uma vez. */
  salvarVarios<T extends NomeTabela>(tabela: T, registros: Tabelas[T][]): Promise<void>;
  /** Insere; falha se a chave já existir. */
  inserir<T extends NomeTabela>(tabela: T, registros: Tabelas[T][]): Promise<void>;
  excluir<T extends NomeTabela>(tabela: T, chave: Partial<Tabelas[T]>): Promise<void>;
  /** Substitui todos os dados (restauração de backup). */
  substituirTudo(s: Snapshot): Promise<void>;
}

export class ErroChaveDuplicada extends Error {
  constructor() {
    super('Registro já existente.');
  }
}

export function mesmaChave<T extends NomeTabela>(tabela: T, a: Tabelas[T], b: Partial<Tabelas[T]>): boolean {
  return CHAVES[tabela].every((k) => a[k] === b[k]);
}
