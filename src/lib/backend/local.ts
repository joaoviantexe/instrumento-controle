import { chaveArquivo, hashArquivo } from '../anexos';
import type { Anexo, Snapshot } from '../types';
import { snapshotInicial } from './inicial';
import { ErroChaveDuplicada, mesmaChave, type AnexosApi, type Backend, type NomeTabela, type ResultadoUnificacao, type Tabelas } from './tipos';

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
    destinoNovo: 'local',
    async listar() {
      const bd = await abrirBd();
      const lista = await pedido(bd.transaction('meta').objectStore('meta').getAll() as IDBRequest<Anexo[]>);
      bd.close();
      return lista.map((a) => ({ ...a, hash: a.hash ?? '', destino: a.destino ?? 'local' })).sort((a, b) => a.criado_em.localeCompare(b.criado_em));
    },
    async enviar(arquivo, destino) {
      const hash = await hashArquivo(arquivo);
      const anexo: Anexo = {
        id: crypto.randomUUID(),
        ...destino,
        nome: arquivo.name,
        tamanho: arquivo.size,
        hash,
        destino: 'local',
        criado_em: new Date().toISOString(),
        criado_por: '',
      };
      const bd = await abrirBd();
      const existe = (await pedido(bd.transaction('arquivos').objectStore('arquivos').getKey(hash))) !== undefined;
      const t = bd.transaction(['meta', 'arquivos'], 'readwrite');
      t.objectStore('meta').put(anexo);
      if (!existe) t.objectStore('arquivos').put(arquivo, hash);
      await terminar(t);
      bd.close();
      return { ...anexo, reaproveitado: existe };
    },
    async abrir(anexo) {
      const bd = await abrirBd();
      const blob = await pedido(bd.transaction('arquivos').objectStore('arquivos').get(chaveArquivo(anexo)) as IDBRequest<Blob | undefined>);
      bd.close();
      if (!blob) throw new Error('O arquivo não foi encontrado neste navegador.');
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
      return url;
    },
    async excluir(anexo) {
      const bd = await abrirBd();
      const restantes = (await pedido(bd.transaction('meta').objectStore('meta').getAll() as IDBRequest<Anexo[]>)).filter(
        (x) => x.id !== anexo.id && chaveArquivo(x) === chaveArquivo(anexo),
      );
      const t = bd.transaction(['meta', 'arquivos'], 'readwrite');
      t.objectStore('meta').delete(anexo.id);
      if (!restantes.length) t.objectStore('arquivos').delete(chaveArquivo(anexo));
      await terminar(t);
      bd.close();
    },
    async unificar() {
      const bd = await abrirBd();
      const metas = await pedido(bd.transaction('meta').objectStore('meta').getAll() as IDBRequest<Anexo[]>);
      const res: ResultadoUnificacao = { analisados: 0, removidos: 0, bytesLiberados: 0 };
      for (const m of metas.filter((x) => !x.hash)) {
        res.analisados++;
        const blob = await pedido(bd.transaction('arquivos').objectStore('arquivos').get(m.id) as IDBRequest<Blob | undefined>);
        if (!blob) continue;
        const hash = await hashArquivo(blob);
        const existe = (await pedido(bd.transaction('arquivos').objectStore('arquivos').getKey(hash))) !== undefined;
        const t = bd.transaction(['meta', 'arquivos'], 'readwrite');
        if (existe) {
          res.removidos++;
          res.bytesLiberados += blob.size;
        } else t.objectStore('arquivos').put(blob, hash);
        t.objectStore('arquivos').delete(m.id);
        t.objectStore('meta').put({ ...m, hash });
        await terminar(t);
      }
      bd.close();
      return res;
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
