import { chaveArquivo, hashArquivo } from '../anexos';
import { comGeral, resumirChecklist, type ChecklistUnidade } from '../checklist';
import { chaveDe, type Conferencia } from '../conferencias';
import { compactar, contarPanorama, expandir, type PanoramaCompacto } from '../panorama';
import type { Anexo, Snapshot } from '../types';
import { snapshotInicial } from './inicial';
import {
  ErroChaveDuplicada,
  mesmaChave,
  type AnexosApi,
  type Backend,
  type ChecklistsApi,
  type ConferenciasApi,
  type InfoPanoramaSalvo,
  type NomeTabela,
  type PanoramasApi,
  type ResultadoUnificacao,
  type Tabelas,
} from './tipos';

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

const CHAVE_CONFERENCIAS = 'instrumento-cde:conferencias:v1';

/** Conferências do modo local: ficam no localStorage, separadas dos dados principais. */
export function criarConferenciasLocal(): ConferenciasApi {
  const ler = (): Conferencia[] => {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_CONFERENCIAS) || '[]') as Conferencia[];
    } catch {
      return [];
    }
  };
  const gravar = (l: Conferencia[]) => {
    try {
      localStorage.setItem(CHAVE_CONFERENCIAS, JSON.stringify(l));
    } catch (e) {
      throw new Error('Não foi possível salvar no navegador: ' + (e as Error).message);
    }
  };
  return {
    async listar() {
      return ler();
    },
    async salvar(c) {
      const nova: Conferencia = { ...c, nota: c.nota ?? '', conferido_por: '', conferido_em: new Date().toISOString() };
      gravar([...ler().filter((x) => chaveDe(x) !== chaveDe(nova)), nova]);
      return nova;
    },
    async excluir(chave) {
      gravar(ler().filter((x) => chaveDe(x) !== chaveDe(chave)));
    },
  };
}

/** Panoramas e checklists do modo local ficam no IndexedDB: juntos, passam do tamanho que o localStorage aceita. */
const NOME_BD_TURMAS = 'instrumento-cde-turmas';
function abrirBdTurmas(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(NOME_BD_TURMAS, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('panoramas', { keyPath: 'ano' });
      r.result.createObjectStore('checklists', { keyPath: ['unidade_id', 'ano'] });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('Não foi possível abrir o armazenamento de turmas.'));
  });
}

async function noBdTurmas<T>(loja: 'panoramas' | 'checklists', modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const bd = await abrirBdTurmas();
  try {
    const t = bd.transaction(loja, modo);
    const r = await pedido(f(t.objectStore(loja)));
    if (modo === 'readwrite') await terminar(t);
    return r;
  } finally {
    bd.close();
  }
}

type PanoramaLocal = InfoPanoramaSalvo & { dados: PanoramaCompacto };

export function criarPanoramasLocal(): PanoramasApi {
  return {
    async listar() {
      const lista = await noBdTurmas('panoramas', 'readonly', (s) => s.getAll() as IDBRequest<PanoramaLocal[]>);
      return lista.map(({ dados: _dados, ...info }) => info).sort((a, b) => b.ano - a.ano);
    },
    async obter(ano) {
      const r = await noBdTurmas('panoramas', 'readonly', (s) => s.get(ano) as IDBRequest<PanoramaLocal | undefined>);
      return r ? expandir(r.dados) : null;
    },
    async salvar(p) {
      const n = contarPanorama(p);
      const registro: PanoramaLocal = { ano: p.ano, fonte: p.fonte, unidades: n.unidades, turmas: n.turmas, alunos: n.alunos, atualizado_em: new Date().toISOString(), atualizado_por: '', dados: compactar(p) };
      await noBdTurmas('panoramas', 'readwrite', (s) => s.put(registro));
    },
    async excluir(ano) {
      await noBdTurmas('panoramas', 'readwrite', (s) => s.delete(ano));
    },
  };
}

export function criarChecklistsLocal(): ChecklistsApi {
  return {
    async listar() {
      const lista = await noBdTurmas('checklists', 'readonly', (s) => s.getAll() as IDBRequest<ChecklistUnidade[]>);
      return lista.map((c) => ({ unidade_id: c.unidade_id, ano: c.ano, arquivo: c.arquivo, ...resumirChecklist(comGeral(c)), atualizado_em: c.atualizado_em, atualizado_por: c.atualizado_por }));
    },
    async obter(unidadeId, ano) {
      const c = await noBdTurmas('checklists', 'readonly', (s) => s.get([unidadeId, ano]) as IDBRequest<ChecklistUnidade | undefined>);
      return c ? comGeral(c) : null;
    },
    async salvar(c) {
      const registro: ChecklistUnidade = { ...c, atualizado_em: new Date().toISOString(), atualizado_por: '' };
      await noBdTurmas('checklists', 'readwrite', (s) => s.put(registro));
      return registro;
    },
    async excluir(unidadeId, ano) {
      await noBdTurmas('checklists', 'readwrite', (s) => s.delete([unidadeId, ano]));
    },
  };
}

function ler(): Snapshot | null {
  try {
    const bruto = localStorage.getItem(CHAVE_STORAGE);
    if (!bruto) return null;
    // Dados gravados antes da avaliação por turma não têm a lista.
    const s = JSON.parse(bruto) as Omit<Snapshot, 'avaliacoes_turma'> & Partial<Snapshot>;
    return { ...s, avaliacoes_turma: s.avaliacoes_turma ?? [] };
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
    conferencias: criarConferenciasLocal(),
    panoramas: criarPanoramasLocal(),
    checklists: criarChecklistsLocal(),
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
        dados.avaliacoes_turma = dados.avaliacoes_turma.filter((a) => a.auditoria_id !== id);
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
