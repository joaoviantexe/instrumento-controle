// Baixa os PDFs do Diário Oficial de Belém (da edição mais nova para a mais antiga) e pode ser interrompido e retomado.
// Precisa rodar num computador com acesso ao site (o site recusa servidores em nuvem e de fora do Brasil).
// Uso: node scripts/diario/coletar.mjs [--pasta diario-pdfs] [--limite N] [--espera 1500]
import { mkdir, readFile, writeFile, rename, access } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = process.env.DIARIO_BASE ?? 'https://sistemas.belem.pa.gov.br/diario-consulta-api/diarios';
const args = process.argv.slice(2);
const opc = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : padrao;
};
const pasta = opc('pasta', 'diario-pdfs');
const limite = Number(opc('limite', Infinity));
const espera = Number(opc('espera', 1500));
const LINHAS = 100;
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
const existe = (p) => access(p).then(() => true, () => false);

async function pedir(url, accept) {
  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    try {
      const r = await fetch(url, { headers: { Accept: accept, 'User-Agent': 'Mozilla/5.0 (coletor CDE/SEMEC)' } });
      if (r.ok) return r;
      if (r.status !== 429 && r.status < 500) throw new Error(`HTTP ${r.status} em ${url}`);
    } catch (e) {
      if (tentativa === 4 || /HTTP 4/.test(String(e.message))) throw e;
    }
    await dorme(2000 * 2 ** tentativa);
  }
  throw new Error(`Falhou: ${url}`);
}

await mkdir(pasta, { recursive: true });
const caminhoIndice = join(pasta, 'indice.json');
const indice = (await existe(caminhoIndice)) ? JSON.parse(await readFile(caminhoIndice, 'utf8')) : {};

let baixados = 0;
let jaTinha = 0;
for (let inicio = 0; ; inicio += LINHAS) {
  const lista = await (await pedir(`${BASE}?start=${inicio}&rows=${LINHAS}`, 'application/json')).json();
  const docs = lista.response?.docs ?? [];
  if (!docs.length) break;
  for (const d of docs) {
    const nome = d.attr_stream_name?.[0] ?? `dom_${d.id}.pdf`;
    const destino = join(pasta, `${d.id}_${nome}`);
    indice[d.id] = { id: d.id, data: d.data_publicacao?.slice(0, 10), arquivo: `${d.id}_${nome}`, bytes: Number(d.attr_stream_size?.[0] ?? 0) };
    if (await existe(destino)) { jaTinha++; continue; }
    if (baixados >= limite) break;
    const r = await pedir(`${BASE}/${d.id}`, 'application/octet-stream');
    const bytes = Buffer.from(await r.arrayBuffer());
    if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new Error(`A edição ${d.id} não veio como PDF (veio ${bytes.length} bytes começando com "${bytes.subarray(0, 40).toString('latin1')}"). O site pode ter mudado.`);
    }
    await writeFile(destino + '.parte', bytes);
    await rename(destino + '.parte', destino); // só aparece com o nome final se baixou inteiro
    baixados++;
    console.log(`${d.id}  ${indice[d.id].data}  ${(bytes.length / 1024).toFixed(0)} KB`);
    await writeFile(caminhoIndice, JSON.stringify(indice, null, 2));
    await dorme(espera);
  }
  if (baixados >= limite) break;
}
await writeFile(caminhoIndice, JSON.stringify(indice, null, 2));
console.log(`\nBaixados agora: ${baixados}. Já existiam: ${jaTinha}. Total no índice: ${Object.keys(indice).length}.`);
