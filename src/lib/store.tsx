import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Acao, Auditoria, Avaliacao, Snapshot, Unidade } from './types';
import type { Backend } from './backend/tipos';
import { ErroChaveDuplicada } from './backend/tipos';
import {
  indexarAvaliacoes,
  linhasRegistradas,
  proximoId,
  resumirAuditoria,
  type Linha,
  type MapaAvaliacoes,
  type ResumoAuditoria,
} from './calc';
import { avisar } from './avisos';

interface Derivados {
  mapaAvaliacoes: MapaAvaliacoes;
  unidadePorId: Map<string, Unidade>;
  auditoriaPorId: Map<string, Auditoria>;
  resumos: Map<string, ResumoAuditoria>;
  linhas: Linha[];
}

export interface Dados extends Snapshot, Derivados {
  modo: Backend['modo'];
  carregando: boolean;
  erro: string | null;
  recarregar(): Promise<void>;
  salvarUnidade(u: Unidade): Promise<void>;
  excluirUnidade(id: string): Promise<boolean>;
  criarAuditoria(a: Omit<Auditoria, 'id'>): Promise<string>;
  salvarAuditoria(a: Auditoria): Promise<void>;
  excluirAuditoria(id: string): Promise<void>;
  salvarAvaliacao(av: Avaliacao): Promise<void>;
  criarAcao(a: Omit<Acao, 'id'>): Promise<string>;
  salvarAcao(a: Acao): Promise<void>;
  excluirAcao(id: string): Promise<void>;
  substituirTudo(s: Snapshot): Promise<void>;
}

const VAZIO: Snapshot = { unidades: [], auditorias: [], avaliacoes: [], acoes: [] };
const Contexto = createContext<Dados | null>(null);

export function DadosProvider({ backend, children }: { backend: Backend; children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const snapRef = useRef(snap);
  snapRef.current = snap;

  const recarregar = useCallback(async () => {
    try {
      setErro(null);
      const s = await backend.carregar();
      setSnap(s);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [backend]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  // No modo compartilhado, atualiza ao voltar para a aba (no máximo a cada 60 s).
  useEffect(() => {
    if (backend.modo !== 'supabase') return;
    let ultima = Date.now();
    const aoVoltar = () => {
      if (document.visibilityState === 'visible' && Date.now() - ultima > 60_000) {
        ultima = Date.now();
        void recarregar();
      }
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [backend, recarregar]);

  /** Aplica a alteração na tela e grava; em caso de falha, avisa e recarrega. */
  const executar = useCallback(
    async (otimista: (s: Snapshot) => Snapshot, gravar: () => Promise<void>) => {
      setSnap((s) => otimista(s));
      try {
        await gravar();
      } catch (e) {
        avisar('Não foi possível salvar: ' + (e as Error).message, 'erro');
        await recarregar();
        throw e;
      }
    },
    [recarregar],
  );

  const derivados = useMemo<Derivados>(() => {
    const mapaAvaliacoes = indexarAvaliacoes(snap.avaliacoes);
    const resumos = new Map(snap.auditorias.map((a) => [a.id, resumirAuditoria(a, mapaAvaliacoes)]));
    return {
      mapaAvaliacoes,
      unidadePorId: new Map(snap.unidades.map((u) => [u.id, u])),
      auditoriaPorId: new Map(snap.auditorias.map((a) => [a.id, a])),
      resumos,
      linhas: linhasRegistradas(snap.auditorias, mapaAvaliacoes),
    };
  }, [snap]);

  const acoes = useMemo(() => {
    const substituir = <T,>(lista: T[], igual: (x: T) => boolean, novo: T) =>
      lista.some(igual) ? lista.map((x) => (igual(x) ? novo : x)) : [...lista, novo];

    return {
      async salvarUnidade(u: Unidade) {
        await executar(
          (s) => ({ ...s, unidades: substituir(s.unidades, (x) => x.id === u.id, u) }),
          () => backend.salvar('unidades', u),
        );
      },
      async excluirUnidade(id: string) {
        if (snapRef.current.auditorias.some((a) => a.unidade_id === id)) return false;
        await executar(
          (s) => ({
            ...s,
            unidades: s.unidades.filter((u) => u.id !== id),
            acoes: s.acoes.map((a) => (a.unidade_id === id ? { ...a, unidade_id: '' } : a)),
          }),
          () => backend.excluir('unidades', { id }),
        );
        return true;
      },
      async criarAuditoria(dados: Omit<Auditoria, 'id'>) {
        for (let tentativa = 0; ; tentativa++) {
          const id = proximoId('AUD', snapRef.current.auditorias.map((a) => a.id));
          const nova = { ...dados, id };
          try {
            await backend.inserir('auditorias', [nova]);
            setSnap((s) => ({ ...s, auditorias: [...s.auditorias, nova] }));
            return id;
          } catch (e) {
            if (e instanceof ErroChaveDuplicada && tentativa < 3) {
              await recarregar();
              continue;
            }
            avisar('Não foi possível salvar: ' + (e as Error).message, 'erro');
            throw e;
          }
        }
      },
      async salvarAuditoria(a: Auditoria) {
        await executar(
          (s) => ({ ...s, auditorias: substituir(s.auditorias, (x) => x.id === a.id, a) }),
          () => backend.salvar('auditorias', a),
        );
      },
      async excluirAuditoria(id: string) {
        await executar(
          (s) => ({
            ...s,
            auditorias: s.auditorias.filter((a) => a.id !== id),
            avaliacoes: s.avaliacoes.filter((a) => a.auditoria_id !== id),
            acoes: s.acoes.map((a) => (a.auditoria_id === id ? { ...a, auditoria_id: '' } : a)),
          }),
          () => backend.excluir('auditorias', { id }),
        );
      },
      async salvarAvaliacao(av: Avaliacao) {
        const aud = snapRef.current.auditorias.find((a) => a.id === av.auditoria_id);
        const iniciar = aud && !aud.iniciada ? { ...aud, iniciada: true } : null;
        await executar(
          (s) => ({
            ...s,
            auditorias: iniciar ? substituir(s.auditorias, (x) => x.id === iniciar.id, iniciar) : s.auditorias,
            avaliacoes: substituir(
              s.avaliacoes,
              (x) => x.auditoria_id === av.auditoria_id && x.item === av.item,
              av,
            ),
          }),
          async () => {
            if (iniciar) await backend.salvar('auditorias', iniciar);
            await backend.salvar('avaliacoes', av);
          },
        );
      },
      async criarAcao(dados: Omit<Acao, 'id'>) {
        for (let tentativa = 0; ; tentativa++) {
          const id = proximoId('AC', snapRef.current.acoes.map((a) => a.id));
          const nova = { ...dados, id };
          try {
            await backend.inserir('acoes', [nova]);
            setSnap((s) => ({ ...s, acoes: [...s.acoes, nova] }));
            return id;
          } catch (e) {
            if (e instanceof ErroChaveDuplicada && tentativa < 3) {
              await recarregar();
              continue;
            }
            avisar('Não foi possível salvar: ' + (e as Error).message, 'erro');
            throw e;
          }
        }
      },
      async salvarAcao(a: Acao) {
        await executar(
          (s) => ({ ...s, acoes: substituir(s.acoes, (x) => x.id === a.id, a) }),
          () => backend.salvar('acoes', a),
        );
      },
      async excluirAcao(id: string) {
        await executar(
          (s) => ({ ...s, acoes: s.acoes.filter((a) => a.id !== id) }),
          () => backend.excluir('acoes', { id }),
        );
      },
      async substituirTudo(novo: Snapshot) {
        await backend.substituirTudo(novo);
        await recarregar();
      },
    };
  }, [backend, executar, recarregar]);

  const valor = useMemo<Dados>(
    () => ({ ...snap, ...derivados, ...acoes, modo: backend.modo, carregando, erro, recarregar }),
    [snap, derivados, acoes, backend.modo, carregando, erro, recarregar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useDados(): Dados {
  const v = useContext(Contexto);
  if (!v) throw new Error('useDados fora de DadosProvider');
  return v;
}
