// Lê PDFs do Diário Oficial e sugere a associação dos atos com as unidades do cadastro.
// Uso: node scripts/diario/analisar.mjs <arquivo.pdf | pasta> [--saida pasta-de-saida]
import { readFile, readdir, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { textoPorPagina } from './texto.mjs';
import { analisarEdicao } from './regras.mjs';

const args = process.argv.slice(2);
const alvo = args.find((a) => !a.startsWith('--'));
const iSaida = args.indexOf('--saida');
const saida = iSaida >= 0 ? args[iSaida + 1] : 'diario-saida';
if (!alvo) {
  console.error('Uso: node scripts/diario/analisar.mjs <arquivo.pdf | pasta> [--saida pasta]');
  process.exit(1);
}

const cadastro = JSON.parse(await readFile(new URL('../../src/data/planilha.json', import.meta.url), 'utf8'));
const unidades = cadastro.unidades;

const arquivos = (await stat(alvo)).isDirectory()
  ? (await readdir(alvo)).filter((f) => /\.pdf$/i.test(f)).sort().map((f) => join(alvo, f))
  : [alvo];

await mkdir(saida, { recursive: true });
const sugestoes = [];
const duvidosos = [];
for (const arq of arquivos) {
  const paginas = await textoPorPagina(arq);
  const r = analisarEdicao(paginas, unidades, { arquivo: basename(arq), paginas_total: paginas.length });
  sugestoes.push(...r.sugestoes);
  duvidosos.push(...r.duvidosos);
  console.log(`${basename(arq)}: ${paginas.length} páginas, ${r.sugestoes.length} sugestões, ${r.duvidosos.length} atos a conferir`);
}
await writeFile(join(saida, 'sugestoes.json'), JSON.stringify(sugestoes, null, 2));
await writeFile(join(saida, 'duvidosos.json'), JSON.stringify(duvidosos, null, 2));
console.log(`\nGravado em ${saida}/sugestoes.json e ${saida}/duvidosos.json`);
