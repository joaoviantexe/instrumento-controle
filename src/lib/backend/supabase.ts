import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { chaveArquivo, hashArquivo } from '../anexos';
import type { Anexo, Snapshot } from '../types';
import { AnexosIndisponiveis, CHAVES, ErroChaveDuplicada, type AnexosApi, type Backend, type NomeTabela, type ResultadoMigracao, type ResultadoUnificacao, type Tabelas, type UsoOperacoes } from './tipos';

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
