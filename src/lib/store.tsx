import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Acao, Anexo, Auditoria, Avaliacao, AvaliacaoTurma, EntidadeAnexo, Snapshot, Unidade } from './types';
import type { Backend, EnvioAnexo, ResultadoMigracao, UsoOperacoes } from './backend/tipos';
import { ErroChaveDuplicada } from './backend/tipos';
import {
  avaliacaoPadrao,
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
import { indexarTurmas, itemDasTurmas, type ChecklistUnidade, type InfoChecklist, type MapaTurmas } from './checklist';
import { associarUnidades, contarPanorama, type Panorama } from './panorama';
import { ANOS_EMBUTIDOS, carregarPanoramaEmbutido } from '../data/panoramas';

/** Um ano do Panorama de Matrícula disponível: embutido no site ou enviado pelo administrador (que prevalece). */
export interface InfoPanorama {
  ano: number;
  fonte: string;
  unidades: number;
  turmas: number;
  alunos: number;
  origem: 'embutido' | 'enviado';
  /** Enviado para um ano que também está embutido no site. */
  substituiEmbutido: boolean;
  atualizado_em: string;
  atualizado_por: string;
}

interface Derivados {
  mapaAvaliacoes: MapaAvaliacoes;
  /** Avaliações por turma: auditoria → item → turma. */
  mapaTurmas: MapaTurmas;
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
  /** Anos do Panorama de Matrícula, do mais recente ao mais antigo. */
  panoramas: InfoPanorama[];
  panoramasErro: string | null;
  /** Turmas do ano (o enviado pelo administrador prevalece sobre o embutido), ligadas ao cadastro atual. */
  obterPanorama(ano: number): Promise<Panorama | null>;
  salvarPanorama(p: Panorama): Promise<void>;
  /** Remove o panorama enviado do ano (o embutido, se houver, volta a valer). */
  excluirPanorama(ano: number): Promise<void>;
  /** Checklists da secretaria escolar já enviadas (resumo). */
  checklists: InfoChecklist[];
  obterChecklist(unidadeId: string, ano: number): Promise<ChecklistUnidade | null>;
  salvarChecklist(c: Omit<ChecklistUnidade, 'atualizado_em' | 'atualizado_por'>): Promise<ChecklistUnidade>;
  excluirChecklist(unidadeId: string, ano: number): Promise<void>;
  /** Grava vários itens da Auditoria Documental de uma vez (ex.: a checklist da secretaria aplicada). */
  salvarAvaliacoes(lista: Avaliacao[]): Promise<void>;
  /**
   * Grava avaliações por turma (de uma auditoria) e recalcula a situação de cada item tocado a partir das turmas.
   * `turmas` são as turmas da unidade no panorama: as que não têm registro contam como não avaliadas.
   */
  salvarAvaliacoesTurma(lista: AvaliacaoTurma[], turmas: string[]): Promise<void>;
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

const VAZIO: Snapshot = { unidades: [], auditorias: [], avaliacoes: [], acoes: [], avaliacoes_turma: [] };
const Contexto = createContext<Dados | null>(null);

export function DadosProvider({ backend, children }: { backend: Backend; children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [anexosErro, setAnexosErro] = useState<string | null>(null);
  const [conferencias, setConferencias] = useState<Conferencia[]>([]);
  const [conferenciasErro, setConferenciasErro] = useState<string | null>(null);
  const [panoramas, setPanoramas] = useState<InfoPanorama[]>([]);
  const [panoramasErro, setPanoramasErro] = useState<string | null>(null);
  const [checklists, setChecklists] = useState<InfoChecklist[]>([]);
  /** Panoramas já carregados, por ano (cada arquivo é grande: só é buscado uma vez). */
  const cachePanoramas = useRef(new Map<number, Promise<Panorama | null>>());
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const unificando = useRef(false);
  const anexosRef = useRef(anexos);
  anexosRef.current = anexos;

  /** Lista os anos: os enviados (banco) e os embutidos que não foram substituídos. */
  const listarPanoramas = useCallback(async () => {
    let enviados: Awaited<ReturnType<Backend['panoramas']['listar']>> = [];
    try {
      enviados = await backend.panoramas.listar();
      setPanoramasErro(null);
    } catch (e) {
      // Sem a tabela, os anos embutidos continuam valendo.
      setPanoramasErro((e as Error).message);
    }
    const lista: InfoPanorama[] = enviados.map((p) => ({ ...p, origem: 'enviado', substituiEmbutido: ANOS_EMBUTIDOS.includes(p.ano) }));
    for (const ano of ANOS_EMBUTIDOS.filter((a) => !lista.some((p) => p.ano === a))) {
      const p = await carregarPanoramaEmbutido(ano);
      if (p) lista.push({ ano, fonte: p.fonte, ...contarPanorama(p), origem: 'embutido', substituiEmbutido: false, atualizado_em: '', atualizado_por: '' });
    }
    setPanoramas(lista.sort((a, b) => b.ano - a.ano));
  }, [backend]);

  const listarChecklists = useCallback(async () => {
    try {
      setChecklists(await backend.checklists.listar());
    } catch {
      // Opcional: sem a tabela, a página da unidade avisa ao tentar enviar.
      setChecklists([]);
    }
  }, [backend]);

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
      cachePanoramas.current.clear();
      void listarPanoramas();
      void listarChecklists();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [backend, listarPanoramas, listarChecklists]);

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
      mapaTurmas: indexarTurmas(snap.avaliacoes_turma),
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
            avaliacoes_turma: s.avaliacoes_turma.filter((a) => a.auditoria_id !== id),
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
      obterPanorama(ano: number) {
        let p = cachePanoramas.current.get(ano);
        if (!p) {
          p = (async () => {
            let bruto: Panorama | null = null;
            try {
              bruto = await backend.panoramas.obter(ano);
            } catch {
              /* sem a tabela: vale o embutido */
            }
            bruto ??= await carregarPanoramaEmbutido(ano);
            if (!bruto) return null;
            // A ligação gravada vale enquanto a unidade existir; unidades novas ou excluídas do cadastro são religadas.
            const gravadas = new Map(bruto.unidades.filter((u) => u.unidade_id).map((u) => [u.codigo, u.unidade_id]));
            return associarUnidades(bruto, snapRef.current.unidades, gravadas);
          })();
          p.catch(() => cachePanoramas.current.delete(ano));
          cachePanoramas.current.set(ano, p);
        }
        return p;
      },
      async salvarPanorama(p: Panorama) {
        await backend.panoramas.salvar(p);
        cachePanoramas.current.delete(p.ano);
        await listarPanoramas();
      },
      async excluirPanorama(ano: number) {
        await backend.panoramas.excluir(ano);
        cachePanoramas.current.delete(ano);
        await listarPanoramas();
      },
      obterChecklist: (unidadeId: string, ano: number) => backend.checklists.obter(unidadeId, ano),
      async salvarChecklist(c: Omit<ChecklistUnidade, 'atualizado_em' | 'atualizado_por'>) {
        const salva = await backend.checklists.salvar(c);
        await listarChecklists();
        return salva;
      },
      async excluirChecklist(unidadeId: string, ano: number) {
        await backend.checklists.excluir(unidadeId, ano);
        await listarChecklists();
      },
      async salvarAvaliacoes(lista: Avaliacao[]) {
        if (!lista.length) return;
        const ids = new Set(lista.map((a) => a.auditoria_id));
        const iniciar = snapRef.current.auditorias.filter((a) => ids.has(a.id) && !a.iniciada).map((a) => ({ ...a, iniciada: true }));
        const chave = (a: Avaliacao) => `${a.auditoria_id}:${a.item}`;
        const novas = new Map(lista.map((a) => [chave(a), a]));
        await executar(
          (s) => ({
            ...s,
            auditorias: s.auditorias.map((a) => iniciar.find((x) => x.id === a.id) ?? a),
            avaliacoes: [...s.avaliacoes.filter((a) => !novas.has(chave(a))), ...novas.values()],
          }),
          async () => {
            if (iniciar.length) await backend.salvarVarios('auditorias', iniciar);
            await backend.salvarVarios('avaliacoes', lista);
          },
        );
      },
      async salvarAvaliacoesTurma(lista: AvaliacaoTurma[], turmas: string[]) {
        if (!lista.length) return;
        const chave = (a: AvaliacaoTurma) => `${a.auditoria_id}|${a.item}|${a.turma}`;
        const novas = new Map(lista.map((a) => [chave(a), a]));
        const todas = [...snapRef.current.avaliacoes_turma.filter((a) => !novas.has(chave(a))), ...novas.values()];
        // A situação do item na auditoria passa a ser a das turmas juntas.
        const itens = [...new Set(lista.map((a) => `${a.auditoria_id}|${a.item}`))].map((k) => {
          const [aud, item] = k.split('|');
          const base = snapRef.current.avaliacoes.find((a) => a.auditoria_id === aud && a.item === item) ?? avaliacaoPadrao(aud, item);
          return itemDasTurmas(base, todas.filter((a) => a.auditoria_id === aud && a.item === item), turmas);
        });
        const ids = new Set(lista.map((a) => a.auditoria_id));
        const iniciar = snapRef.current.auditorias.filter((a) => ids.has(a.id) && !a.iniciada).map((a) => ({ ...a, iniciada: true }));
        const chaveItem = (a: Avaliacao) => `${a.auditoria_id}|${a.item}`;
        const novosItens = new Map(itens.map((a) => [chaveItem(a), a]));
        await executar(
          (s) => ({
            ...s,
            auditorias: s.auditorias.map((a) => iniciar.find((x) => x.id === a.id) ?? a),
            avaliacoes_turma: [...s.avaliacoes_turma.filter((a) => !novas.has(chave(a))), ...novas.values()],
            avaliacoes: [...s.avaliacoes.filter((a) => !novosItens.has(chaveItem(a))), ...novosItens.values()],
          }),
          async () => {
            if (iniciar.length) await backend.salvarVarios('auditorias', iniciar);
            await backend.salvarVarios('avaliacoes_turma', lista);
            await backend.salvarVarios('avaliacoes', itens);
          },
        );
      },
      async importarRegistros(s: Snapshot) {
        try {
          await backend.salvarVarios('unidades', s.unidades);
          await backend.salvarVarios('auditorias', s.auditorias);
          await backend.salvarVarios('avaliacoes', s.avaliacoes);
          await backend.salvarVarios('acoes', s.acoes);
          if (s.avaliacoes_turma.length) await backend.salvarVarios('avaliacoes_turma', s.avaliacoes_turma);
        } finally {
          await recarregar();
        }
      },
      async substituirTudo(novo: Snapshot) {
        await backend.substituirTudo(novo);
        await recarregar();
      },
    };
  }, [backend, executar, recarregar, limparAnexos, listarPanoramas, listarChecklists]);

  const valor = useMemo<Dados>(
    () => ({ ...snap, ...derivados, ...acoes, anexos, anexosErro, conferencias, mapaConferencias: indexarConferencias(conferencias), conferenciasErro, panoramas, panoramasErro, checklists, destinoAnexos: backend.anexos.destinoNovo, modo: backend.modo, carregando, erro, recarregar }),
    [snap, derivados, acoes, anexos, anexosErro, conferencias, conferenciasErro, panoramas, panoramasErro, checklists, backend, carregando, erro, recarregar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useDados(): Dados {
  const v = useContext(Contexto);
  if (!v) throw new Error('useDados fora de DadosProvider');
  return v;
}
