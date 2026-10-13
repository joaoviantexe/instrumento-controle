import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Acao, Anexo, Auditoria, Avaliacao, EntidadeAnexo, Snapshot, Unidade } from './types';
import type { Backend, EnvioAnexo, ResultadoMigracao, UsoOperacoes } from './backend/tipos';
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
import { hashArquivo, verificarEspaco } from './anexos';
import { indexarConferencias, type ChaveConferencia, type Conferencia, type Decisao, type FonteAto, type MapaConferencias } from './conferencias';
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
  /** Onde os novos PDFs são gravados. */
  destinoAnexos: 'local' | 'supabase' | 'r2';
  /** Copia para o R2 os PDFs que ainda estão no Supabase (só no modo R2). */
  migrarAnexos(): Promise<ResultadoMigracao>;
  /** Operações do mês contadas no servidor (só no modo R2). */
  usoOperacoes(): Promise<UsoOperacoes | null>;
  excluirAnexo(anexo: Anexo): Promise<void>;
  abrirAnexo(anexo: Anexo): Promise<string>;
  /** Decisões de quem conferiu as associações de atos (Diário Oficial e CME). */
  conferencias: Conferencia[];
  mapaConferencias: MapaConferencias;
  /** Mensagem quando a conferência não está disponível (ex.: script do banco desatualizado). */
  conferenciasErro: string | null;
  /** Confirma ou recusa uma associação ato → unidade. */
  conferir(c: { fonte: FonteAto; ato_id: string; unidade_id: string; decisao: Decisao; nota?: string }): Promise<void>;
  /** Desfaz a decisão: a associação volta a ser a do arquivo de dados. */
  desfazerConferencia(chave: ChaveConferencia): Promise<void>;
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
  const [conferencias, setConferencias] = useState<Conferencia[]>([]);
  const [conferenciasErro, setConferenciasErro] = useState<string | null>(null);
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const unificando = useRef(false);
  const anexosRef = useRef(anexos);
  anexosRef.current = anexos;

  const recarregar = useCallback(async () => {
    try {
      setErro(null);
      const s = await backend.carregar();
      setSnap(s);
      setCarregando(false);
      try {
        const lista = await backend.anexos.listar();
        setAnexos(lista);
        setAnexosErro(null);
        // Anexos antigos (sem hash) são unificados sozinhos, uma vez por sessão.
        if (!unificando.current && lista.some((x) => !x.hash)) {
          unificando.current = true;
          void backend.anexos
            .unificar()
            .then(async () => setAnexos(await backend.anexos.listar()))
            .catch(() => undefined);
        }
      } catch (e) {
        // Anexos são opcionais: o restante do sistema continua funcionando sem eles.
        setAnexos([]);
        setAnexosErro((e as Error).message);
      }
      try {
        setConferencias(await backend.conferencias.listar());
        setConferenciasErro(null);
      } catch (e) {
        // Opcional como os anexos: sem a tabela, as associações aparecem como no arquivo de dados.
        setConferencias([]);
        setConferenciasErro((e as Error).message);
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
        const recusa = verificarEspaco(anexosRef.current, arquivo.size, await hashArquivo(arquivo));
        if (recusa) throw new Error(recusa);
        const { reaproveitado, ...a } = await backend.anexos.enviar(arquivo, destino);
        setAnexos((l) => [...l, a]);
        return { ...a, reaproveitado };
      },
      async migrarAnexos() {
        try {
          return (await backend.anexos.migrar?.()) ?? { movidos: 0, restantes: 0 };
        } finally {
          setAnexos(await backend.anexos.listar());
        }
      },
      usoOperacoes: async () => (await backend.anexos.uso?.()) ?? null,
      async excluirAnexo(anexo: Anexo) {
        await backend.anexos.excluir(anexo);
        setAnexos((l) => l.filter((x) => x.id !== anexo.id));
      },
      abrirAnexo: (anexo: Anexo) => backend.anexos.abrir(anexo),
      async conferir(c: { fonte: FonteAto; ato_id: string; unidade_id: string; decisao: Decisao; nota?: string }) {
        const salva = await backend.conferencias.salvar({ ...c, nota: c.nota ?? '' });
        setConferencias((l) => [...l.filter((x) => !(x.fonte === c.fonte && x.ato_id === c.ato_id && x.unidade_id === c.unidade_id)), salva]);
      },
      async desfazerConferencia(chave: ChaveConferencia) {
        await backend.conferencias.excluir(chave);
        setConferencias((l) => l.filter((x) => !(x.fonte === chave.fonte && x.ato_id === chave.ato_id && x.unidade_id === chave.unidade_id)));
      },
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
    () => ({ ...snap, ...derivados, ...acoes, anexos, anexosErro, conferencias, mapaConferencias: indexarConferencias(conferencias), conferenciasErro, destinoAnexos: backend.anexos.destinoNovo, modo: backend.modo, carregando, erro, recarregar }),
    [snap, derivados, acoes, anexos, anexosErro, conferencias, conferenciasErro, backend, carregando, erro, recarregar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useDados(): Dados {
  const v = useContext(Contexto);
  if (!v) throw new Error('useDados fora de DadosProvider');
  return v;
}
