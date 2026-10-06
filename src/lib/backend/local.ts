import type { Snapshot } from '../types';
import { snapshotInicial } from './inicial';
import { ErroChaveDuplicada, mesmaChave, type Backend, type NomeTabela, type Tabelas } from './tipos';

const CHAVE_STORAGE = 'instrumento-cde:dados:v1';

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
