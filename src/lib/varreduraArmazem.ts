import type { AtoEncontrado, Edicao } from './varreduraDiario';

/** Resultado da leitura de uma edição, guardado no navegador para a varredura poder parar e continuar. */
export interface EdicaoLida extends Edicao {
  situacao: 'lida' | 'sem-texto' | 'erro';
  paginas?: number;
  atos: AtoEncontrado[];
  erro?: string;
}

const BANCO = 'varredura-diario';
const EDICOES = 'edicoes';
const META = 'meta';

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const r = indexedDB.open(BANCO, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore(EDICOES, { keyPath: 'id' });
      r.result.createObjectStore(META);
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => falha(r.error);
  });
}

async function operar<T>(loja: string, modo: IDBTransactionMode, fazer: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  try {
    return await new Promise<T>((ok, falha) => {
      const tx = db.transaction(loja, modo);
      const r = fazer(tx.objectStore(loja));
      tx.oncomplete = () => ok(r.result);
      tx.onerror = () => falha(tx.error);
      tx.onabort = () => falha(tx.error);
    });
  } finally {
    db.close();
  }
}

export const salvarEdicao = (e: EdicaoLida) => operar(EDICOES, 'readwrite', (s) => s.put(e)).then(() => undefined);
export const edicoesLidas = () => operar<EdicaoLida[]>(EDICOES, 'readonly', (s) => s.getAll());
export const salvarLista = (lista: Edicao[]) => operar(META, 'readwrite', (s) => s.put(lista, 'lista')).then(() => undefined);
export const listaGuardada = () => operar<Edicao[] | undefined>(META, 'readonly', (s) => s.get('lista'));

/** Apaga tudo o que a varredura guardou neste navegador. */
export async function limparVarredura() {
  await operar(EDICOES, 'readwrite', (s) => s.clear());
  await operar(META, 'readwrite', (s) => s.clear());
}
