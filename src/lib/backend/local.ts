import type { Anexo, Snapshot } from '../types';
import { snapshotInicial } from './inicial';
import { ErroChaveDuplicada, mesmaChave, type AnexosApi, type Backend, type NomeTabela, type Tabelas } from './tipos';

const CHAVE_STORAGE = 'instrumento-cde:dados:v1';
const NOME_BD_ANEXOS = 'instrumento-cde-anexos';

/** PDFs do modo local ficam no IndexedDB do navegador (o localStorage é pequeno demais para arquivos). */
function abrirBd(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(NOME_BD_ANEXOS, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('meta', { keyPath: 'id' });
      r.result.createObjectStore('arquivos');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('Não foi possível abrir o armazenamento de anexos.'));
  });
}

function pedido<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function terminar(t: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export function criarAnexosLocal(): AnexosApi {
  return {
    async listar() {
      const bd = await abrirBd();
      const lista = await pedido(bd.transaction('meta').objectStore('meta').getAll() as IDBRequest<Anexo[]>);
      bd.close();
      return lista.sort((a, b) => a.criado_em.localeCompare(b.criado_em));
    },
    async enviar(arquivo, destino) {
      const anexo: Anexo = {
        id: crypto.randomUUID(),
        ...destino,
        nome: arquivo.name,
        tamanho: arquivo.size,
        criado_em: new Date().toISOString(),
        criado_por: '',
      };
      const bd = await abrirBd();
      const t = bd.transaction(['meta', 'arquivos'], 'readwrite');
      t.objectStore('meta').put(anexo);
      t.objectStore('arquivos').put(arquivo, anexo.id);
      await terminar(t);
      bd.close();
      return anexo;
    },
    async abrir(anexo) {
      const bd = await abrirBd();
      const blob = await pedido(bd.transaction('arquivos').objectStore('arquivos').get(anexo.id) as IDBRequest<Blob | undefined>);
      bd.close();
      if (!blob) throw new Error('O arquivo não foi encontrado neste navegador.');
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
      return url;
    },
    async excluir(anexo) {
      const bd = await abrirBd();
      const t = bd.transaction(['meta', 'arquivos'], 'readwrite');
      t.objectStore('meta').delete(anexo.id);
      t.objectStore('arquivos').delete(anexo.id);
      await terminar(t);
      bd.close();
    },
  };
}

function ler(): Snapshot | null {
  try {
    const bruto = localStorage.getItem(CHAVE_STORAGE);
    return bruto ? (JSON.parse(bruto) as Snapshot) : null;
  } catch {
    return null;
  }
}

/** Dados salvos apenas neste navegador (localStorage). */
export function criarBackendLocal(): Backend {
  let dados: Snapshot = ler() ?? snapshotInicial();

  function gravar() {
    try {
      localStorage.setItem(CHAVE_STORAGE, JSON.stringify(dados));
    } catch (e) {
      throw new Error('Não foi possível salvar no navegador: ' + (e as Error).message);
    }
  }

  function lista<T extends NomeTabela>(tabela: T): Tabelas[T][] {
    return dados[tabela] as Tabelas[T][];
  }

  return {
    modo: 'local',
    anexos: criarAnexosLocal(),
    async carregar() {
      const salvo = ler();
      if (salvo) dados = salvo;
      else gravar();
      return structuredClone(dados);
    },
    async salvar(tabela, registro) {
      const l = lista(tabela);
      const i = l.findIndex((r) => mesmaChave(tabela, r, registro));
      if (i >= 0) l[i] = { ...registro };
      else l.push({ ...registro });
      gravar();
    },
    async salvarVarios(tabela, registros) {
      const l = lista(tabela);
      for (const registro of registros) {
        const i = l.findIndex((r) => mesmaChave(tabela, r, registro));
        if (i >= 0) l[i] = { ...registro };
        else l.push({ ...registro });
      }
      gravar();
    },
    async inserir(tabela, registros) {
      const l = lista(tabela);
      for (const r of registros) {
        if (l.some((x) => mesmaChave(tabela, x, r))) throw new ErroChaveDuplicada();
      }
      l.push(...registros.map((r) => ({ ...r })));
      gravar();
    },
    async excluir(tabela, chave) {
      const l = lista(tabela);
      (dados[tabela] as unknown) = l.filter((r) => !mesmaChave(tabela, r, chave));
      if (tabela === 'auditorias') {
        const id = (chave as Partial<Tabelas['auditorias']>).id;
        dados.avaliacoes = dados.avaliacoes.filter((a) => a.auditoria_id !== id);
        dados.acoes = dados.acoes.map((a) => (a.auditoria_id === id ? { ...a, auditoria_id: '' } : a));
      }
      if (tabela === 'unidades') {
        const id = (chave as Partial<Tabelas['unidades']>).id;
        dados.acoes = dados.acoes.map((a) => (a.unidade_id === id ? { ...a, unidade_id: '' } : a));
      }
      gravar();
    },
    async substituirTudo(s) {
      dados = structuredClone(s);
      gravar();
    },
  };
}
