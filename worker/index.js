/**
 * Worker do Cloudflare para os anexos em PDF (arquivo único: pode ser colado no editor do painel da Cloudflare).
 *
 * Ligações e variáveis (Settings do Worker):
 *   BUCKET (R2 binding)      bucket com os PDFs
 *   SUPABASE_URL             endereço do projeto Supabase
 *   SUPABASE_ANON_KEY        chave anon/publishable do Supabase
 *   ORIGENS                  endereços do site autorizados (CORS), separados por vírgula
 *   LINK_SECRET (Secret)     texto aleatório longo, usado para assinar os links de abertura
 *   LIMITE_BYTES             limite de armazenamento em bytes (padrão: 9 GB)
 *   LIMITE_A / LIMITE_B      limites mensais de gravações / leituras (padrão: 900000 / 9000000)
 *
 * O Worker só atende quem está logado no Supabase e consta na tabela "membros", recusa
 * gravações acima dos limites e confere o conteúdo (PDF íntegro, hash conferido).
 */

const TAMANHO_MAX = 10 * 1024 * 1024;
const MARGEM = 0.95;
const VALIDADE_LINK_S = 120;
const HASH = /^[0-9a-f]{64}$/;

const enc = new TextEncoder();

function cors(env, request) {
  const origem = request.headers.get('Origin') || '';
  const permitidas = (env.ORIGENS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const h = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (permitidas.includes(origem)) h['Access-Control-Allow-Origin'] = origem;
  return h;
}

function resposta(env, request, corpo, status = 200, extra = {}) {
  return new Response(typeof corpo === 'string' || corpo instanceof ReadableStream ? corpo : JSON.stringify(corpo), {
    status,
    headers: { ...cors(env, request), ...(typeof corpo === 'string' || corpo instanceof ReadableStream ? {} : { 'Content-Type': 'application/json' }), ...extra },
  });
}

const erro = (env, request, mensagem, status) => resposta(env, request, { erro: mensagem }, status);

async function rpc(env, token, nome, args) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args || {}),
  });
  if (!r.ok) return { ok: false, status: r.status };
  return { ok: true, valor: await r.json() };
}

/** Confere o login e a autorização (tabela membros). */
async function autorizar(env, request) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const r = await rpc(env, token, 'is_membro');
  return r.ok && r.valor === true ? token : null;
}

async function sha256(buffer) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function assinar(env, texto) {
  const chave = await crypto.subtle.importKey('raw', enc.encode(env.LINK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = new Uint8Array(await crypto.subtle.sign('HMAC', chave, enc.encode(texto)));
  return Array.from(s, (b) => b.toString(16).padStart(2, '0')).join('');
}

const limiteA = (env) => Number(env.LIMITE_A) || 900000;
const limiteB = (env) => Number(env.LIMITE_B) || 9000000;
const limiteBytes = (env) => Number(env.LIMITE_BYTES) || 9 * 1024 ** 3;

/** Reserva uma operação do mês; false quando o limite foi atingido. */
async function reservar(env, token, tipo, limite) {
  const r = await rpc(env, token, 'reservar_operacao', { p_tipo: tipo, p_qtd: 1, p_limite: limite });
  return r.ok && r.valor === true;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, request) });

    // Abertura por link assinado (o navegador não envia o login ao abrir uma nova aba).
    const m = /^\/arquivos\/([0-9a-f]{64})$/.exec(url.pathname);
    if (request.method === 'GET' && m) {
      const exp = Number(url.searchParams.get('e'));
      const sig = url.searchParams.get('s') || '';
      if (!exp || exp < Date.now() / 1000 || sig !== (await assinar(env, `${m[1]}.${exp}`))) {
        return erro(env, request, 'Link inválido ou expirado.', 403);
      }
      const obj = await env.BUCKET.get(`${m[1]}.pdf`);
      if (!obj) return erro(env, request, 'Arquivo não encontrado.', 404);
      return new Response(obj.body, {
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
      });
    }

    const token = await autorizar(env, request);
    if (!token) return erro(env, request, 'Não autorizado.', 401);

    // Gravar: PUT /arquivos/<hash>
    if (request.method === 'PUT' && m) {
      const hash = m[1];
      const declarado = Number(request.headers.get('Content-Length') || 0);
      if (declarado > TAMANHO_MAX) return erro(env, request, 'Arquivo acima de 10 MB.', 413);
      const corpo = await request.arrayBuffer();
      if (corpo.byteLength === 0 || corpo.byteLength > TAMANHO_MAX) return erro(env, request, 'Tamanho inválido (máximo 10 MB).', 413);
      if (new TextDecoder().decode(corpo.slice(0, 5)) !== '%PDF-') return erro(env, request, 'O arquivo não é um PDF.', 415);
      if ((await sha256(corpo)) !== hash) return erro(env, request, 'O conteúdo não confere com o hash informado.', 400);

      if (!(await reservar(env, token, 'B', limiteB(env)))) return erro(env, request, 'Limite mensal de leituras atingido.', 429);
      if (await env.BUCKET.head(`${hash}.pdf`)) return resposta(env, request, { reaproveitado: true }, 200);

      const usados = await rpc(env, token, 'bytes_usados_r2');
      if (!usados.ok) return erro(env, request, 'Não foi possível verificar o espaço.', 502);
      if (Number(usados.valor) + corpo.byteLength > limiteBytes(env) * MARGEM) {
        return erro(env, request, 'Limite de armazenamento atingido.', 413);
      }
      if (!(await reservar(env, token, 'A', limiteA(env)))) return erro(env, request, 'Limite mensal de gravações atingido.', 429);
      await env.BUCKET.put(`${hash}.pdf`, corpo, { httpMetadata: { contentType: 'application/pdf' } });
      return resposta(env, request, { reaproveitado: false }, 201);
    }

    // Gerar link de abertura: POST /abrir {hash}
    if (request.method === 'POST' && url.pathname === '/abrir') {
      let hash = '';
      try {
        hash = (await request.json()).hash || '';
      } catch {
        /* corpo inválido */
      }
      if (!HASH.test(hash)) return erro(env, request, 'Arquivo inválido.', 400);
      if (!(await reservar(env, token, 'B', limiteB(env)))) return erro(env, request, 'Limite mensal de leituras atingido.', 429);
      const exp = Math.floor(Date.now() / 1000) + VALIDADE_LINK_S;
      const sig = await assinar(env, `${hash}.${exp}`);
      return resposta(env, request, { url: `${url.origin}/arquivos/${hash}?e=${exp}&s=${sig}` });
    }

    // Excluir: DELETE /arquivos/<hash>
    if (request.method === 'DELETE' && m) {
      if (!(await reservar(env, token, 'A', limiteA(env)))) return erro(env, request, 'Limite mensal de gravações atingido.', 429);
      await env.BUCKET.delete(`${m[1]}.pdf`);
      return resposta(env, request, { ok: true });
    }

    return erro(env, request, 'Não encontrado.', 404);
  },
};
