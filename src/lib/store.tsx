import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Acao, Anexo, Auditoria, Avaliacao, EntidadeAnexo, Snapshot, Unidade } from './types';
import type { Backend, EnvioAnexo, ResultadoUnificacao } from './backend/tipos';
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
  anexos: Anexo[];
  /** Mensagem quando o recurso de anexos não está disponível (ex.: script do banco desatualizado). */
  anexosErro: string | null;
  enviarAnexo(arquivo: File, destino: { entidade: EntidadeAnexo; entidade_id: string; categoria: string }): Promise<EnvioAnexo>;
  /** Une arquivos idênticos (e migra anexos antigos) para liberar espaço. */
  unificarAnexos(): Promise<ResultadoUnificacao>;
  excluirAnexo(anexo: Anexo): Promise<void>;
  abrirAnexo(anexo: Anexo): Promise<string>;
  carregando: boolean;
  erro: string | null;
  recarregar(): Promise<void>;
  salvarUnidade(u: Unidade): Promise<void>;
  excluirUnidade(id: string): Promise<boolean>;
  criarAuditoria(a: Omit<Auditoria, 'id'>): Promise<string>;
  salvarAuditoria(a: Auditoria): Promise<void>;
  /** Altera várias auditorias de uma vez (planejamento em lote). */
  salvarAuditorias(lista: Auditoria[]): Promise<void>;
  excluirAuditoria(id: string): Promise<void>;
  salvarAvaliacao(av: Avaliacao): Promise<void>;
  criarAcao(a: Omit<Acao, 'id'>): Promise<string>;
  salvarAcao(a: Acao): Promise<void>;
  excluirAcao(id: string): Promise<void>;
  substituirTudo(s: Snapshot): Promise<void>;
  /** Grava (cria ou atualiza) os registros informados, sem excluir nenhum outro. */
  importarRegistros(s: Snapshot): Promise<void>;
}

const VAZIO: Snapshot = { unidades: [], auditorias: [], avaliacoes: [], acoes: [] };
const Contexto = createContext<Dados | null>(null);

export function DadosProvider({ backend, children }: { backend: Backend; children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [anexosErro, setAnexosErro] = useState<string | null>(null);
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const anexosRef = useRef(anexos);
  anexosRef.current = anexos;

  const recarregar = useCallback(async () => {
    try {
      setErro(null);
      const s = await backend.carregar();
      setSnap(s);
      setCarregando(false);
      try {
        setAnexos(await backend.anexos.listar());
        setAnexosErro(null);
      } catch (e) {
        // Anexos são opcionais: o restante do sistema continua funcionando sem eles.
        setAnexos([]);
        setAnexosErro((e as Error).message);
      }
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

  /** Remove os PDFs de um registro excluído (melhor esforço: falhas não impedem a exclusão). */
  const limparAnexos = useCallback(
    async (dono: (a: Anexo) => boolean) => {
      const alvo = anexosRef.current.filter(dono);
      const removidos = new Set<string>();
      for (const a of alvo) {
        try {
          await backend.anexos.excluir(a);
          removidos.add(a.id);
        } catch {
          /* arquivo órfão não atrapalha o uso */
        }
      }
      if (removidos.size) setAnexos((l) => l.filter((x) => !removidos.has(x.id)));
    },
    [backend],
  );

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
        void limparAnexos((a) => a.entidade === 'unidade' && a.entidade_id === id);
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
      async salvarAuditorias(lista: Auditoria[]) {
        const mapa = new Map(lista.map((a) => [a.id, a]));
        await executar(
          (s) => ({ ...s, auditorias: s.auditorias.map((a) => mapa.get(a.id) ?? a) }),
          () => backend.salvarVarios('auditorias', lista),
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
        void limparAnexos(
          (a) => (a.entidade === 'auditoria' && a.entidade_id === id) || (a.entidade === 'avaliacao' && a.entidade_id.startsWith(`${id}:`)),
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
        void limparAnexos((a) => a.entidade === 'acao' && a.entidade_id === id);
      },
      async enviarAnexo(arquivo: File, destino: { entidade: EntidadeAnexo; entidade_id: string; categoria: string }) {
        const { reaproveitado, ...a } = await backend.anexos.enviar(arquivo, destino);
        setAnexos((l) => [...l, a]);
        return { ...a, reaproveitado };
      },
      async unificarAnexos() {
        try {
          return await backend.anexos.unificar();
        } finally {
          setAnexos(await backend.anexos.listar());
        }
      },
      async excluirAnexo(anexo: Anexo) {
        await backend.anexos.excluir(anexo);
        setAnexos((l) => l.filter((x) => x.id !== anexo.id));
      },
      abrirAnexo: (anexo: Anexo) => backend.anexos.abrir(anexo),
      async importarRegistros(s: Snapshot) {
        try {
          await backend.salvarVarios('unidades', s.unidades);
          await backend.salvarVarios('auditorias', s.auditorias);
          await backend.salvarVarios('avaliacoes', s.avaliacoes);
          await backend.salvarVarios('acoes', s.acoes);
        } finally {
          await recarregar();
        }
      },
      async substituirTudo(novo: Snapshot) {
        await backend.substituirTudo(novo);
        await recarregar();
      },
    };
  }, [backend, executar, recarregar, limparAnexos]);

  const valor = useMemo<Dados>(
    () => ({ ...snap, ...derivados, ...acoes, anexos, anexosErro, modo: backend.modo, carregando, erro, recarregar }),
    [snap, derivados, acoes, anexos, anexosErro, backend.modo, carregando, erro, recarregar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useDados(): Dados {
  const v = useContext(Contexto);
  if (!v) throw new Error('useDados fora de DadosProvider');
  return v;
}
