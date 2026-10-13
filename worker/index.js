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
 *
 * Exceção pública (o Diário Oficial do Município é público):
 *   GET /diario/<número da edição>.pdf   a edição, buscada no painel da Prefeitura, para o navegador abrir na página do ato (#page=N)
 *   GET /diario/edicoes?start=0&rows=100 a lista de edições (número, data e arquivo), usada pela varredura do site
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

const DIARIO_API = 'https://sistemas.belem.pa.gov.br/diario-consulta-api/diarios';
const PAINEL_DIARIO = 'https://sistemas.belem.pa.gov.br/diario/painel';
const DIARIO = /^\/diario\/(\d{1,7})(?:\.pdf)?$/;

/** Acrescenta o CORS do site a uma resposta (inclusive às guardadas no cache), para a varredura poder lê-la. */
function comCors(env, request, resposta) {
  const r = new Response(resposta.body, resposta);
  for (const [k, v] of Object.entries(cors(env, request))) r.headers.set(k, v);
  return r;
}

/** Lista de edições do painel, de 100 em 100 (a mais recente primeiro). */
async function edicoesDiario(url) {
  const start = Number(url.searchParams.get('start') || 0);
  const rows = Number(url.searchParams.get('rows') || 100);
  if (!Number.isInteger(start) || start < 0 || start > 1e6 || !Number.isInteger(rows) || rows < 1 || rows > 100) {
    return new Response(JSON.stringify({ erro: 'Parâmetros inválidos.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const r = await fetch(`${DIARIO_API}?start=${start}&rows=${rows}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
    if (r.ok) {
      const dados = await r.json();
      return new Response(JSON.stringify(dados), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' } });
    }
  } catch {
    /* responde com o erro abaixo */
  }
  return new Response(JSON.stringify({ erro: 'O site da Prefeitura não respondeu.' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
}

/** Página simples avisando que a edição não pôde ser obtida, com o caminho para achá-la no painel. */
function avisoDiario(numero, pagina) {
  const onde = pagina ? `a página ${pagina}` : 'a página do ato';
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diário Oficial nº ${numero}</title>
<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5">
<h1 style="font-size:1.3rem">Não foi possível abrir a edição nº ${numero} agora</h1>
<p>O site da Prefeitura não respondeu ou não entregou o PDF. Abra o <a href="${PAINEL_DIARIO}">painel do Diário Oficial</a>,
procure a edição nº ${numero} e vá até ${onde}.</p></body></html>`;
  return new Response(html, { status: 502, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

/** Busca a edição no painel do Diário (o PDF só vem quando o pedido aceita octet-stream) e confere se é um PDF. */
async function buscarEdicao(numero) {
  for (const accept of ['application/octet-stream', 'application/pdf, */*']) {
    try {
      const r = await fetch(`${DIARIO_API}/${numero}`, { headers: { Accept: accept }, signal: AbortSignal.timeout(25000) });
      if (!r.ok) continue;
      const corpo = await r.arrayBuffer();
      if (new TextDecoder().decode(corpo.slice(0, 5)) === '%PDF-') return corpo;
    } catch {
      /* tenta o próximo formato */
    }
  }
  return null;
}

async function diarioOficial(numero, url, ctx) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const chave = new Request(`${url.origin}/diario/${numero}.pdf`);
  const guardada = cache && (await cache.match(chave));
  if (guardada) return guardada;
  const corpo = await buscarEdicao(numero);
  const pagina = Number(url.searchParams.get('pagina')) || 0;
  if (!corpo) return avisoDiario(numero, pagina);
  const resposta = new Response(corpo, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="dom-${numero}.pdf"`,
      // Uma edição publicada não muda: guarda por 30 dias para não pedir de novo ao site da Prefeitura.
      'Cache-Control': 'public, max-age=2592000',
      'X-Content-Type-Options': 'nosniff',
    },
  });
  if (cache && ctx) ctx.waitUntil(cache.put(chave, resposta.clone()));
  return resposta;
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
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, request) });

    // Diário Oficial (público): abre a edição no navegador e alimenta a varredura do site, sem login.
    if (request.method === 'GET' && url.pathname === '/diario/edicoes') return comCors(env, request, await edicoesDiario(url));
    const d = DIARIO.exec(url.pathname);
    if (request.method === 'GET' && d) {
      // "0015011" e "15011" são a mesma edição: sem isso, cada variação furaria o cache e geraria um pedido novo à Prefeitura.
      const numero = String(Number(d[1]));
      if (numero === '0') return comCors(env, request, new Response('Edição inválida.', { status: 400 }));
      return comCors(env, request, await diarioOficial(numero, url, ctx));
    }

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
