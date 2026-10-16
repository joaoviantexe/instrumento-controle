import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { chaveArquivo, hashArquivo } from '../anexos';
import { comGeral, resumirChecklist, type ChecklistUnidade, type RespostasTurma } from '../checklist';
import type { Conferencia } from '../conferencias';
import { compactar, contarPanorama, expandir, type PanoramaCompacto } from '../panorama';
import type { Anexo, Snapshot } from '../types';
import {
  AnexosIndisponiveis,
  ConferenciasIndisponiveis,
  CHAVES,
  ErroChaveDuplicada,
  TurmasIndisponiveis,
  type AnexosApi,
  type Backend,
  type ChecklistsApi,
  type ConferenciasApi,
  type NomeTabela,
  type PanoramasApi,
  type ResultadoMigracao,
  type ResultadoUnificacao,
  type Tabelas,
  type UsoOperacoes,
} from './tipos';

type Env = Record<string, string | undefined>;
const env = import.meta.env as unknown as Env;

/** Aceita os nomes usados pelo painel do Supabase e por integrações que usam o prefixo NEXT_PUBLIC_. */
export const SUPABASE_URL = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_CHAVE =
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_CHAVE);

let cliente: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!cliente) {
    cliente = createClient(SUPABASE_URL, SUPABASE_CHAVE, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return cliente;
}

const CAMPOS_META = ['atualizado_em', 'atualizado_por'];
const TAMANHO_PAGINA = 1000;
const TAMANHO_LOTE = 500;

/** null → '' (os formulários trabalham com texto vazio). */
function doBanco<T>(linha: Record<string, unknown>): T {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(linha)) {
    if (CAMPOS_META.includes(k)) continue;
    r[k] = v === null ? '' : v;
  }
  return r as T;
}

/** '' → null (colunas de data não aceitam texto vazio). */
function paraBanco(registro: object): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(registro)) {
    if (CAMPOS_META.includes(k)) continue;
    r[k] = v === '' ? null : v;
  }
  return r;
}

/** Colunas de avaliacoes criadas para a checklist da secretaria (podem faltar num banco com o script antigo). */
const COLUNAS_VERIFICACAO = ['declarado', 'declaracao', 'verificacao'];

/** Avaliações sem declaração não enviam as colunas novas: o banco com o script antigo continua aceitando as gravações. */
function semColunasVazias(tabela: NomeTabela, registro: Record<string, unknown>): Record<string, unknown> {
  if (tabela !== 'avaliacoes') return registro;
  const r = { ...registro };
  for (const k of COLUNAS_VERIFICACAO) if (r[k] === null || r[k] === undefined) delete r[k];
  return r;
}

/** O banco ainda não tem uma tabela ou coluna nova (script SQL desatualizado). */
class BancoDesatualizado extends Error {
  constructor() {
    super('o banco ainda não tem as tabelas e colunas da checklist e da avaliação por turma. Execute o arquivo supabase/schema.sql atualizado no SQL Editor do Supabase.');
  }
}

function verificar(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === '23505') throw new ErroChaveDuplicada();
  // PGRST204 = coluna inexistente; PGRST205/42P01 = tabela inexistente (script do banco desatualizado)
  if ((error.code === 'PGRST204' && COLUNAS_VERIFICACAO.some((c) => error.message.includes(`'${c}'`))) || ausente(error)) throw new BancoDesatualizado();
  throw new Error(error.message);
}

async function lerTudo<T extends NomeTabela>(sb: SupabaseClient, tabela: T): Promise<Tabelas[T][]> {
  const saida: Tabelas[T][] = [];
  const chaves = CHAVES[tabela] as string[];
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    let q = sb.from(tabela).select('*');
    for (const k of chaves) q = q.order(k);
    const { data, error } = await q.range(de, de + TAMANHO_PAGINA - 1);
    verificar(error);
    saida.push(...(data ?? []).map((l) => doBanco<Tabelas[T]>(l)));
    if (!data || data.length < TAMANHO_PAGINA) break;
  }
  return saida;
}

const BUCKET = 'anexos';

function ausente(error: { code?: string; message: string }): boolean {
  // 42P01 = tabela inexistente; PGRST205 = tabela fora do cache do PostgREST; 404 do Storage = bucket inexistente
  return error.code === '42P01' || error.code === 'PGRST205' || /bucket not found|does not exist/i.test(error.message);
}

/** Endereço do Worker da Cloudflare (R2). Vazio = os PDFs ficam no Supabase Storage. */
export const ANEXOS_URL = (env.VITE_ANEXOS_URL || '').replace(/\/+$/, '');

function criarAnexosSupabase(sb: SupabaseClient): AnexosApi {
  const arquivos = () => sb.storage.from(BUCKET);
  const jaExiste = (e: { message: string; statusCode?: string }) => e.statusCode === '409' || /already exists|Duplicate/i.test(e.message);

  /** Chamada ao Worker, com o login do Supabase. */
  async function worker(caminho: string, init: RequestInit): Promise<Response> {
    if (!ANEXOS_URL) {
      throw new Error('Este endereço do site não está ligado ao Cloudflare R2 (falta a variável VITE_ANEXOS_URL), onde estes PDFs estão guardados. Use o site configurado para o R2 ou cadastre a variável e publique de novo.');
    }
    const token = (await sb.auth.getSession()).data.session?.access_token;
    if (!token) throw new Error('Sessão expirada. Entre novamente.');
    const r = await fetch(ANEXOS_URL + caminho, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      const msg = ((await r.json().catch(() => ({}))) as { erro?: string }).erro;
      throw new Error(msg || `Falha ao falar com o armazenamento (${r.status}).`);
    }
    return r;
  }

  async function listar() {
    const { data, error } = await sb.from('anexos').select('*').order('criado_em');
    if (error) {
      if (ausente(error)) throw new AnexosIndisponiveis();
      throw new Error(error.message);
    }
    return (data ?? []).map((l) => {
      const a = doBanco<Anexo>(l);
      return { ...a, destino: a.destino || 'supabase' };
    });
  }

  /** Há outro anexo usando o mesmo arquivo (no mesmo lugar)? */
  async function emUso(anexo: Anexo): Promise<boolean> {
    const chave = chaveArquivo(anexo);
    const { data, error } = await sb
      .from('anexos')
      .select('id')
      .or(`hash.eq.${chave},id.eq.${chave}`)
      .eq('destino', anexo.destino || 'supabase')
      .neq('id', anexo.id)
      .limit(1);
    if (error) throw new Error(error.message);
    return (data ?? []).length > 0;
  }

  return {
    destinoNovo: ANEXOS_URL ? 'r2' : 'supabase',
    listar,
    async enviar(arquivo, destino) {
      const hash = await hashArquivo(arquivo);
      const { data: igual, error: e0 } = await sb.from('anexos').select('id, destino').eq('hash', hash).limit(1);
      if (e0) {
        if (ausente(e0)) throw new AnexosIndisponiveis();
        throw new Error(e0.message);
      }
      let onde: string = (igual?.[0] as { destino?: string } | undefined)?.destino || '';
      const reaproveitado = (igual ?? []).length > 0;
      if (!reaproveitado) {
        if (ANEXOS_URL) {
          await worker(`/arquivos/${hash}`, { method: 'PUT', body: arquivo });
          onde = 'r2';
        } else {
          const up = await arquivos().upload(`${hash}.pdf`, arquivo, { contentType: 'application/pdf', upsert: false });
          if (up.error && !jaExiste(up.error as { message: string; statusCode?: string })) {
            if (ausente(up.error)) throw new AnexosIndisponiveis();
            throw new Error(up.error.message);
          }
          onde = 'supabase';
        }
      }
      const { data, error } = await sb
        .from('anexos')
        .insert(paraBanco({ id: crypto.randomUUID(), ...destino, nome: arquivo.name, tamanho: arquivo.size, hash, destino: onde || 'supabase' }))
        .select()
        .single();
      if (error) {
        if (ausente(error)) throw new AnexosIndisponiveis();
        throw new Error(error.message);
      }
      return { ...doBanco<Anexo>(data), reaproveitado };
    },
    async abrir(anexo) {
      if (anexo.destino === 'r2') {
        const r = await worker('/abrir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash: anexo.hash }) });
        return ((await r.json()) as { url: string }).url;
      }
      const { data, error } = await arquivos().createSignedUrl(`${chaveArquivo(anexo)}.pdf`, 120);
      if (error || !data) throw new Error(error?.message ?? 'Não foi possível abrir o arquivo.');
      return data.signedUrl;
    },
    async excluir(anexo) {
      const { error } = await sb.from('anexos').delete().eq('id', anexo.id);
      if (error) throw new Error(error.message);
      if (await emUso(anexo)) return;
      if (anexo.destino === 'r2') {
        await worker(`/arquivos/${anexo.hash}`, { method: 'DELETE' });
      } else {
        const r = await arquivos().remove([`${chaveArquivo(anexo)}.pdf`]);
        if (r.error) throw new Error(r.error.message);
      }
    },
    async unificar() {
      const res: ResultadoUnificacao = { analisados: 0, removidos: 0, bytesLiberados: 0 };
      const todos = await listar();
      const guardados = new Set(todos.filter((a) => a.hash && a.destino === 'supabase').map((a) => a.hash));
      for (const a of todos.filter((x) => !x.hash)) {
        res.analisados++;
        const baixado = await arquivos().download(`${a.id}.pdf`);
        if (baixado.error || !baixado.data) continue;
        const hash = await hashArquivo(baixado.data);
        if (!guardados.has(hash)) {
          const up = await arquivos().upload(`${hash}.pdf`, baixado.data, { contentType: 'application/pdf', upsert: false });
          if (up.error && !jaExiste(up.error as { message: string; statusCode?: string })) throw new Error(up.error.message);
          guardados.add(hash);
        } else {
          res.removidos++;
          res.bytesLiberados += a.tamanho;
        }
        const { error } = await sb.from('anexos').update({ hash }).eq('id', a.id);
        if (error) throw new Error(error.message);
        await arquivos().remove([`${a.id}.pdf`]);
      }
      return res;
    },
    ...(ANEXOS_URL
      ? {
          async migrar(): Promise<ResultadoMigracao> {
            const pendentes = (await listar()).filter((a) => a.destino !== 'r2' && a.hash);
            const grupos = [...new Set(pendentes.map((a) => a.hash))];
            let movidos = 0;
            for (const hash of grupos) {
              try {
                const baixado = await arquivos().download(`${hash}.pdf`);
                if (baixado.error || !baixado.data) throw new Error(baixado.error?.message ?? 'arquivo não encontrado no Supabase');
                await worker(`/arquivos/${hash}`, { method: 'PUT', body: baixado.data });
                const { error } = await sb.from('anexos').update({ destino: 'r2' }).eq('hash', hash).eq('destino', 'supabase');
                if (error) throw new Error(error.message);
                await arquivos().remove([`${hash}.pdf`]);
                movidos++;
              } catch (e) {
                return { movidos, restantes: grupos.length - movidos, parouPor: (e as Error).message };
              }
            }
            return { movidos, restantes: 0 };
          },
          async uso(): Promise<UsoOperacoes | null> {
            const mes = new Date().toISOString().slice(0, 7);
            const { data, error } = await sb.from('uso_operacoes').select('tipo,total').eq('mes', mes);
            if (error) return null;
            const soma = { A: 0, B: 0 };
            for (const l of data ?? []) soma[(l as { tipo: 'A' | 'B' }).tipo] = Number((l as { total: number }).total);
            return soma;
          },
        }
      : {}),
  };
}

function criarConferenciasSupabase(sb: SupabaseClient): ConferenciasApi {
  const dalinha = (l: Record<string, unknown>): Conferencia => ({
    fonte: l.fonte as Conferencia['fonte'],
    ato_id: String(l.ato_id),
    unidade_id: String(l.unidade_id),
    decisao: l.decisao as Conferencia['decisao'],
    nota: String(l.nota ?? ''),
    conferido_por: String(l.atualizado_por ?? ''),
    conferido_em: String(l.atualizado_em ?? ''),
  });
  const falhar = (error: { code?: string; message: string }): never => {
    if (ausente(error)) throw new ConferenciasIndisponiveis();
    throw new Error(error.message);
  };
  return {
    async listar() {
      const { data, error } = await sb.from('conferencias').select('*').order('atualizado_em');
      if (error) falhar(error);
      return (data ?? []).map(dalinha);
    },
    async salvar(c) {
      const { data, error } = await sb
        .from('conferencias')
        .upsert({ fonte: c.fonte, ato_id: c.ato_id, unidade_id: c.unidade_id, decisao: c.decisao, nota: c.nota || null }, { onConflict: 'fonte,ato_id,unidade_id' })
        .select()
        .single();
      if (error) falhar(error);
      return dalinha(data as Record<string, unknown>);
    },
    async excluir(chave) {
      const { error } = await sb.from('conferencias').delete().eq('fonte', chave.fonte).eq('ato_id', chave.ato_id).eq('unidade_id', chave.unidade_id);
      if (error) falhar(error);
    },
  };
}

/** Erro de tabela ausente (script do banco desatualizado) ou de permissão. */
function falhaTurmas(error: { code?: string; message: string }): never {
  if (ausente(error)) throw new TurmasIndisponiveis();
  if (error.code === '42501') throw new Error('o banco recusou a gravação. Execute o arquivo supabase/schema.sql atualizado no SQL Editor do Supabase.');
  throw new Error(error.message);
}

function criarPanoramasSupabase(sb: SupabaseClient): PanoramasApi {
  return {
    async listar() {
      const { data, error } = await sb.from('panoramas').select('ano, fonte, unidades, turmas, alunos, atualizado_em, atualizado_por').order('ano', { ascending: false });
      if (error) falhaTurmas(error);
      return (data ?? []).map((l) => {
        const r = doBanco<Record<string, unknown>>(l);
        return { ano: Number(r.ano), fonte: String(r.fonte), unidades: Number(r.unidades), turmas: Number(r.turmas), alunos: Number(r.alunos), atualizado_em: String(l.atualizado_em ?? ''), atualizado_por: String(l.atualizado_por ?? '') };
      });
    },
    async obter(ano) {
      const { data, error } = await sb.from('panoramas').select('dados').eq('ano', ano).maybeSingle();
      if (error) falhaTurmas(error);
      return data ? expandir((data as { dados: PanoramaCompacto }).dados) : null;
    },
    async salvar(p) {
      const n = contarPanorama(p);
      const { error } = await sb
        .from('panoramas')
        .upsert({ ano: p.ano, fonte: p.fonte, unidades: n.unidades, turmas: n.turmas, alunos: n.alunos, dados: compactar(p) }, { onConflict: 'ano' });
      if (error) falhaTurmas(error);
    },
    async excluir(ano) {
      const { error } = await sb.from('panoramas').delete().eq('ano', ano);
      if (error) falhaTurmas(error);
    },
  };
}

function criarChecklistsSupabase(sb: SupabaseClient): ChecklistsApi {
  const daLinha = (l: Record<string, unknown>): ChecklistUnidade => {
    const dados = (l.dados ?? {}) as { geral?: RespostasTurma; turmas?: Record<string, RespostasTurma> };
    return comGeral({
      unidade_id: String(l.unidade_id),
      ano: Number(l.ano),
      arquivo: String(l.arquivo ?? ''),
      geral: dados.geral,
      turmas: dados.turmas ?? {},
      atualizado_em: String(l.atualizado_em ?? ''),
      atualizado_por: String(l.atualizado_por ?? ''),
    });
  };
  return {
    async listar() {
      const { data, error } = await sb.from('checklists').select('unidade_id, ano, arquivo, turmas_respondidas, itens_pendentes, atualizado_em, atualizado_por');
      if (error) falhaTurmas(error);
      return (data ?? []).map((l) => ({
        unidade_id: String(l.unidade_id),
        ano: Number(l.ano),
        arquivo: String(l.arquivo ?? ''),
        turmas: Number(l.turmas_respondidas ?? 0),
        pendentes: Number(l.itens_pendentes ?? 0),
        atualizado_em: String(l.atualizado_em ?? ''),
        atualizado_por: String(l.atualizado_por ?? ''),
      }));
    },
    async obter(unidadeId, ano) {
      const { data, error } = await sb.from('checklists').select('*').eq('unidade_id', unidadeId).eq('ano', ano).maybeSingle();
      if (error) falhaTurmas(error);
      return data ? daLinha(data as Record<string, unknown>) : null;
    },
    async salvar(c) {
      const r = resumirChecklist(c);
      const { data, error } = await sb
        .from('checklists')
        .upsert(
          { unidade_id: c.unidade_id, ano: c.ano, arquivo: c.arquivo, turmas_respondidas: r.turmas, itens_pendentes: r.pendentes, dados: { geral: c.geral, turmas: c.turmas } },
          { onConflict: 'unidade_id,ano' },
        )
        .select()
        .single();
      if (error) falhaTurmas(error);
      return daLinha(data as Record<string, unknown>);
    },
    async excluir(unidadeId, ano) {
      const { error } = await sb.from('checklists').delete().eq('unidade_id', unidadeId).eq('ano', ano);
      if (error) falhaTurmas(error);
    },
  };
}

export function criarBackendSupabase(sb: SupabaseClient = supabase()): Backend {

  async function inserirEmLotes(tabela: NomeTabela, registros: object[]) {
    for (let i = 0; i < registros.length; i += TAMANHO_LOTE) {
      const { error } = await sb.from(tabela).insert(registros.slice(i, i + TAMANHO_LOTE).map((r) => semColunasVazias(tabela, paraBanco(r))));
      verificar(error);
    }
  }

  return {
    modo: 'supabase',
    anexos: criarAnexosSupabase(sb),
    conferencias: criarConferenciasSupabase(sb),
    panoramas: criarPanoramasSupabase(sb),
    checklists: criarChecklistsSupabase(sb),
    async carregar(): Promise<Snapshot> {
      const [unidades, auditorias, avaliacoes, acoes, avaliacoes_turma] = await Promise.all([
        lerTudo(sb, 'unidades'),
        lerTudo(sb, 'auditorias'),
        lerTudo(sb, 'avaliacoes'),
        lerTudo(sb, 'acoes'),
        // Banco com o script antigo: sem avaliações por turma, o resto funciona. Outras falhas não são escondidas: com a lista
        // incompleta, a próxima avaliação de uma turma recalcularia o item com dados faltando.
        lerTudo(sb, 'avaliacoes_turma').catch((e: unknown) => {
          if (e instanceof BancoDesatualizado) return [];
          throw e;
        }),
      ]);
      return { unidades, auditorias, avaliacoes, acoes, avaliacoes_turma };
    },
    async salvar(tabela, registro) {
      const { error } = await sb
        .from(tabela)
        .upsert(semColunasVazias(tabela, paraBanco(registro)), { onConflict: (CHAVES[tabela] as string[]).join(',') });
      verificar(error);
    },
    async salvarVarios(tabela, registros) {
      const conflito = (CHAVES[tabela] as string[]).join(',');
      for (let i = 0; i < registros.length; i += TAMANHO_LOTE) {
        const { error } = await sb
          .from(tabela)
          .upsert(registros.slice(i, i + TAMANHO_LOTE).map((r) => semColunasVazias(tabela, paraBanco(r))), { onConflict: conflito });
        verificar(error);
      }
    },
    async inserir(tabela, registros) {
      await inserirEmLotes(tabela, registros);
    },
    async excluir(tabela, chave) {
      let q = sb.from(tabela).delete();
      for (const [k, v] of Object.entries(chave)) q = q.eq(k, v as string);
      const { error } = await q;
      verificar(error);
    },
    async substituirTudo(s) {
      for (const tabela of ['acoes', 'avaliacoes_turma', 'avaliacoes', 'auditorias', 'unidades'] as const) {
        const coluna = (CHAVES[tabela] as string[])[0];
        const { error } = await sb.from(tabela).delete().not(coluna, 'is', null);
        // A tabela de turmas pode não existir num banco com o script antigo (e sai junto com as auditorias).
        if (error && tabela === 'avaliacoes_turma' && ausente(error)) continue;
        verificar(error);
      }
      await inserirEmLotes('unidades', s.unidades);
      await inserirEmLotes('auditorias', s.auditorias);
      await inserirEmLotes('avaliacoes', s.avaliacoes);
      await inserirEmLotes('acoes', s.acoes);
      await inserirEmLotes('avaliacoes_turma', s.avaliacoes_turma ?? []);
    },
  };
}

/** Verifica se o e-mail autenticado está na tabela de membros autorizados (todo membro é administrador). */
export async function verificarMembro(): Promise<boolean> {
  const { data, error } = await supabase().from('membros').select('email').limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}
