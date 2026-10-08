import type { Acao, Auditoria, Anexo, Avaliacao, EntidadeAnexo, Snapshot, Unidade } from '../types';

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

export type EnvioAnexo = Anexo & { reaproveitado: boolean };

export interface ResultadoUnificacao {
  analisados: number;
  /** Arquivos duplicados apagados. */
  removidos: number;
  bytesLiberados: number;
}

/** Anexos em PDF: metadados em tabela e arquivos no armazenamento. */
export interface AnexosApi {
  listar(): Promise<Anexo[]>;
  /** Se já existe um arquivo idêntico (mesmo conteúdo), ele é reaproveitado em vez de gravado de novo. */
  enviar(arquivo: File, destino: { entidade: EntidadeAnexo; entidade_id: string; categoria: string }): Promise<EnvioAnexo>;
  /** Passa os anexos antigos para o armazenamento por conteúdo e apaga as cópias idênticas. */
  unificar(): Promise<ResultadoUnificacao>;
  /** Devolve um endereço temporário para abrir o PDF. */
  abrir(anexo: Anexo): Promise<string>;
  excluir(anexo: Anexo): Promise<void>;
}

/** O banco ainda não tem a tabela/armazenamento de anexos (script SQL desatualizado). */
export class AnexosIndisponiveis extends Error {
  constructor() {
    super('Os anexos ainda não estão habilitados neste banco. Execute o arquivo supabase/schema.sql atualizado no SQL Editor do Supabase.');
  }
}

export interface Backend {
  modo: 'local' | 'supabase';
  anexos: AnexosApi;
  carregar(): Promise<Snapshot>;
  /** Insere ou atualiza. */
  salvar<T extends NomeTabela>(tabela: T, registro: Tabelas[T]): Promise<void>;
  /** Insere ou atualiza vários registros de uma vez. */
  salvarVarios<T extends NomeTabela>(tabela: T, registros: Tabelas[T][]): Promise<void>;
  /** Insere; falha se a chave já existir. */
  inserir<T extends NomeTabela>(tabela: T, registros: Tabelas[T][]): Promise<void>;
  excluir<T extends NomeTabela>(tabela: T, chave: Partial<Tabelas[T]>): Promise<void>;
  /** Substitui todos os dados (restauração dos dados originais). */
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
