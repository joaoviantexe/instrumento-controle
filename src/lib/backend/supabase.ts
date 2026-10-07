import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Anexo, Snapshot } from '../types';
import { AnexosIndisponiveis, CHAVES, ErroChaveDuplicada, type AnexosApi, type Backend, type NomeTabela, type Tabelas } from './tipos';

type Env = Record<string, string | undefined>;
const env = import.meta.env as unknown as Env;

/** Aceita os nomes usados pelo painel do Supabase e pela integração Supabase da Vercel. */
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

function verificar(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === '23505') throw new ErroChaveDuplicada();
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

function criarAnexosSupabase(sb: SupabaseClient): AnexosApi {
  return {
    async listar() {
      const { data, error } = await sb.from('anexos').select('*').order('criado_em');
      if (error) {
        if (ausente(error)) throw new AnexosIndisponiveis();
        throw new Error(error.message);
      }
      return (data ?? []).map((l) => doBanco<Anexo>(l));
    },
    async enviar(arquivo, destino) {
      const id = crypto.randomUUID();
      const caminho = `${id}.pdf`;
      const up = await sb.storage.from(BUCKET).upload(caminho, arquivo, { contentType: 'application/pdf', upsert: false });
      if (up.error) {
        if (ausente(up.error)) throw new AnexosIndisponiveis();
        throw new Error(up.error.message);
      }
      const { data, error } = await sb
        .from('anexos')
        .insert(paraBanco({ id, ...destino, nome: arquivo.name, tamanho: arquivo.size }))
        .select()
        .single();
      if (error) {
        await sb.storage.from(BUCKET).remove([caminho]); // não deixa arquivo órfão
        if (ausente(error)) throw new AnexosIndisponiveis();
        throw new Error(error.message);
      }
      return doBanco<Anexo>(data);
    },
    async abrir(anexo) {
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(`${anexo.id}.pdf`, 120);
      if (error || !data) throw new Error(error?.message ?? 'Não foi possível abrir o arquivo.');
      return data.signedUrl;
    },
    async excluir(anexo) {
      const r = await sb.storage.from(BUCKET).remove([`${anexo.id}.pdf`]);
      if (r.error) throw new Error(r.error.message);
      const { error } = await sb.from('anexos').delete().eq('id', anexo.id);
      if (error) throw new Error(error.message);
    },
  };
}

export function criarBackendSupabase(sb: SupabaseClient = supabase()): Backend {

  async function inserirEmLotes(tabela: NomeTabela, registros: object[]) {
    for (let i = 0; i < registros.length; i += TAMANHO_LOTE) {
      const { error } = await sb.from(tabela).insert(registros.slice(i, i + TAMANHO_LOTE).map(paraBanco));
      verificar(error);
    }
  }

  return {
    modo: 'supabase',
    anexos: criarAnexosSupabase(sb),
    async carregar(): Promise<Snapshot> {
      const [unidades, auditorias, avaliacoes, acoes] = await Promise.all([
        lerTudo(sb, 'unidades'),
        lerTudo(sb, 'auditorias'),
        lerTudo(sb, 'avaliacoes'),
        lerTudo(sb, 'acoes'),
      ]);
      return { unidades, auditorias, avaliacoes, acoes };
    },
    async salvar(tabela, registro) {
      const { error } = await sb
        .from(tabela)
        .upsert(paraBanco(registro), { onConflict: (CHAVES[tabela] as string[]).join(',') });
      verificar(error);
    },
    async salvarVarios(tabela, registros) {
      const conflito = (CHAVES[tabela] as string[]).join(',');
      for (let i = 0; i < registros.length; i += TAMANHO_LOTE) {
        const { error } = await sb
          .from(tabela)
          .upsert(registros.slice(i, i + TAMANHO_LOTE).map(paraBanco), { onConflict: conflito });
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
      for (const tabela of ['acoes', 'avaliacoes', 'auditorias', 'unidades'] as const) {
        const coluna = (CHAVES[tabela] as string[])[0];
        const { error } = await sb.from(tabela).delete().not(coluna, 'is', null);
        verificar(error);
      }
      await inserirEmLotes('unidades', s.unidades);
      await inserirEmLotes('auditorias', s.auditorias);
      await inserirEmLotes('avaliacoes', s.avaliacoes);
      await inserirEmLotes('acoes', s.acoes);
    },
  };
}

/** Verifica se o e-mail autenticado está na tabela de membros autorizados. */
export async function verificarMembro(): Promise<boolean> {
  const { data, error } = await supabase().from('membros').select('email').limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}
