import { describe, expect, it } from 'vitest';
// @ts-expect-error arquivo JavaScript puro (colado no painel da Cloudflare)
import worker from '../../worker/index.js';

const enc = new TextEncoder();
async function hash(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf)), (b) => b.toString(16).padStart(2, '0')).join('');
}

function ambiente(opcoes: { membro?: boolean; permitidoA?: boolean; permitidoB?: boolean; usados?: number; limiteBytes?: number } = {}) {
  const { membro = true, permitidoA = true, permitidoB = true, usados = 0, limiteBytes } = opcoes;
  const arquivos = new Map<string, ArrayBuffer>();
  const chamadas: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const nome = String(url).split('/rpc/')[1];
    chamadas.push(nome);
    const args = JSON.parse((init.body as string) || '{}');
    const auth = (init.headers as Record<string, string>).Authorization;
    if (auth !== 'Bearer token-valido') return new Response('{}', { status: 401 });
    const valor = nome === 'is_membro' ? membro : nome === 'bytes_usados_r2' ? usados : args.p_tipo === 'A' ? permitidoA : permitidoB;
    return new Response(JSON.stringify(valor), { status: 200 });
  }) as typeof fetch;
  const env = {
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
    ORIGENS: 'https://site.exemplo',
    LINK_SECRET: 'segredo-longo-de-teste',
    LIMITE_BYTES: limiteBytes,
    BUCKET: {
      async head(k: string) { return arquivos.has(k) ? {} : null; },
      async get(k: string) { const b = arquivos.get(k); return b ? { body: new Blob([b]).stream() } : null; },
      async put(k: string, b: ArrayBuffer) { arquivos.set(k, b); },
      async delete(k: string) { arquivos.delete(k); },
    },
  };
  return { env, arquivos, chamadas, restaurar: () => (globalThis.fetch = original) };
}

const pdf = enc.encode('%PDF-1.4 conteudo de teste').buffer as ArrayBuffer;
const req = (metodo: string, caminho: string, corpo?: BodyInit, token = 'token-valido') =>
  new Request('https://w.exemplo' + caminho, { method: metodo, body: corpo, headers: { Authorization: `Bearer ${token}`, Origin: 'https://site.exemplo' } });

describe('worker de anexos', () => {
  it('grava um PDF íntegro e reaproveita um idêntico sem gravar de novo', async () => {
    const a = ambiente();
    const h = await hash(pdf);
    const r1 = await worker.fetch(req('PUT', `/arquivos/${h}`, pdf), a.env);
    expect(r1.status).toBe(201);
    expect(a.arquivos.has(`${h}.pdf`)).toBe(true);
    expect(r1.headers.get('Access-Control-Allow-Origin')).toBe('https://site.exemplo');
    const r2 = await worker.fetch(req('PUT', `/arquivos/${h}`, pdf), a.env);
    expect(r2.status).toBe(200);
    expect((await r2.json()).reaproveitado).toBe(true);
    a.restaurar();
  });

  it('recusa quem não está logado ou autorizado', async () => {
    const a = ambiente();
    const h = await hash(pdf);
    expect((await worker.fetch(req('PUT', `/arquivos/${h}`, pdf, 'token-falso'), a.env)).status).toBe(401);
    a.restaurar();
    const b = ambiente({ membro: false });
    expect((await worker.fetch(req('PUT', `/arquivos/${h}`, pdf), b.env)).status).toBe(401);
    b.restaurar();
  });

  it('recusa arquivo que não é PDF e hash que não confere', async () => {
    const a = ambiente();
    const texto = enc.encode('isto nao e pdf').buffer as ArrayBuffer;
    expect((await worker.fetch(req('PUT', `/arquivos/${await hash(texto)}`, texto), a.env)).status).toBe(415);
    expect((await worker.fetch(req('PUT', `/arquivos/${'0'.repeat(64)}`, pdf), a.env)).status).toBe(400);
    a.restaurar();
  });

  it('recusa quando os limites mensais ou de armazenamento são atingidos', async () => {
    const h = await hash(pdf);
    const a = ambiente({ permitidoA: false });
    expect((await worker.fetch(req('PUT', `/arquivos/${h}`, pdf), a.env)).status).toBe(429);
    expect(a.arquivos.size).toBe(0);
    a.restaurar();
    const b = ambiente({ permitidoB: false });
    expect((await worker.fetch(req('PUT', `/arquivos/${h}`, pdf), b.env)).status).toBe(429);
    b.restaurar();
    const c = ambiente({ usados: 95, limiteBytes: 100 });
    expect((await worker.fetch(req('PUT', `/arquivos/${h}`, pdf), c.env)).status).toBe(413);
    c.restaurar();
  });

  it('abre por link assinado e expirado/forjado é recusado', async () => {
    const a = ambiente();
    const h = await hash(pdf);
    await worker.fetch(req('PUT', `/arquivos/${h}`, pdf), a.env);
    const r = await worker.fetch(req('POST', '/abrir', JSON.stringify({ hash: h })), a.env);
    const { url } = await r.json();
    const u = new URL(url);
    const ok = await worker.fetch(new Request('https://w.exemplo' + u.pathname + u.search), a.env);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('Content-Type')).toBe('application/pdf');
    expect((await worker.fetch(new Request('https://w.exemplo' + u.pathname + '?e=1&s=' + u.searchParams.get('s')), a.env)).status).toBe(403);
    expect((await worker.fetch(new Request('https://w.exemplo' + u.pathname + `?e=${u.searchParams.get('e')}&s=forjado`), a.env)).status).toBe(403);
    a.restaurar();
  });

  it('exclui o arquivo', async () => {
    const a = ambiente();
    const h = await hash(pdf);
    await worker.fetch(req('PUT', `/arquivos/${h}`, pdf), a.env);
    expect((await worker.fetch(req('DELETE', `/arquivos/${h}`), a.env)).status).toBe(200);
    expect(a.arquivos.size).toBe(0);
    a.restaurar();
  });
});

describe('worker: Diário Oficial', () => {
  function diario(respostas: (accept: string) => Response | Promise<Response>) {
    const pedidos: { url: string; accept: string }[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      const accept = (init.headers as Record<string, string>).Accept;
      pedidos.push({ url: String(url), accept });
      return respostas(accept);
    }) as typeof fetch;
    return { pedidos, restaurar: () => (globalThis.fetch = original) };
  }
  const env = ambiente().env;
  const abrir = (caminho: string) => worker.fetch(new Request('https://w.exemplo' + caminho), env);

  it('entrega a edição como PDF para abrir no navegador, sem exigir login', async () => {
    const d = diario(() => new Response(pdf));
    const r = await abrir('/diario/15011.pdf?pagina=2');
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toBe('application/pdf');
    expect(r.headers.get('Content-Disposition')).toContain('inline');
    expect(d.pedidos[0]).toEqual({ url: 'https://sistemas.belem.pa.gov.br/diario-consulta-api/diarios/15011', accept: 'application/octet-stream' });
    d.restaurar();
  });

  it('tenta outro formato quando o site devolve os dados da edição em vez do PDF', async () => {
    const d = diario((accept) => (accept === 'application/octet-stream' ? new Response('{"id":15011}') : new Response(pdf)));
    expect((await abrir('/diario/15011')).headers.get('Content-Type')).toBe('application/pdf');
    expect(d.pedidos).toHaveLength(2);
    d.restaurar();
  });

  it('explica como achar a edição quando o site da Prefeitura não responde', async () => {
    const d = diario(() => {
      throw new Error('recusado');
    });
    const r = await abrir('/diario/15011.pdf?pagina=7');
    expect(r.status).toBe(502);
    const html = await r.text();
    expect(html).toContain('edição nº 15011');
    expect(html).toContain('página 7');
    d.restaurar();
  });

  it('só aceita número de edição', async () => {
    const d = diario(() => new Response(pdf));
    expect((await abrir('/diario/abc')).status).toBe(401);
    expect(d.pedidos).toHaveLength(0);
    d.restaurar();
  });
});

describe('worker: lista de edições e CORS do Diário', () => {
  const env = ambiente().env;
  const pedir = (caminho: string, origem = 'https://site.exemplo') => worker.fetch(new Request('https://w.exemplo' + caminho, { headers: { Origin: origem } }), env);
  function falso(resposta: () => Response) {
    const urls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      urls.push(String(url));
      return resposta();
    }) as typeof fetch;
    return { urls, restaurar: () => (globalThis.fetch = original) };
  }

  it('repassa a lista de edições do painel, com CORS para o site', async () => {
    const lista = { response: { numFound: 1, start: 0, docs: [{ id: '15011', data_publicacao: '2024-08-16T03:00:00Z' }] } };
    const f = falso(() => new Response(JSON.stringify(lista)));
    const r = await pedir('/diario/edicoes?start=200&rows=100');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual(lista);
    expect(f.urls[0]).toBe('https://sistemas.belem.pa.gov.br/diario-consulta-api/diarios?start=200&rows=100');
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://site.exemplo');
    f.restaurar();
  });

  it('recusa parâmetros fora do limite sem consultar o painel', async () => {
    const f = falso(() => new Response('{}'));
    expect((await pedir('/diario/edicoes?rows=5000')).status).toBe(400);
    expect((await pedir('/diario/edicoes?start=-1')).status).toBe(400);
    expect(f.urls).toHaveLength(0);
    f.restaurar();
  });

  it('a edição em PDF também sai com CORS para o site (e não para outras origens)', async () => {
    const f = falso(() => new Response(pdf));
    expect((await pedir('/diario/15011.pdf')).headers.get('Access-Control-Allow-Origin')).toBe('https://site.exemplo');
    expect((await pedir('/diario/15011.pdf', 'https://outro.exemplo')).headers.get('Access-Control-Allow-Origin')).toBeNull();
    f.restaurar();
  });
});
