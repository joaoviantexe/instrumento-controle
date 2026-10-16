/**
 * Gera src/data/panoramas/<ano>.json (turmas embutidas no site) a partir do Panorama de Matrícula do SIGA.
 *
 * Uso (Node 22.18+, que lê o TypeScript de src/lib/panorama.ts sem compilar):
 *   node scripts/panorama/extrair.mjs "dados/panorama-matricula/arquivo.xlsx"
 *
 * As unidades são ligadas ao Cadastro (src/data/planilha.json) pelo INEP e pelo nome, como no site. Para anos que não
 * precisam ficar embutidos, basta o administrador enviar a planilha em Dados e planilhas → Turmas.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { associarUnidades, compactar, contarPanorama, expandir, linhasDaAba, lerLinhasPanorama } from '../../src/lib/panorama.ts';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PASTA = join(RAIZ, 'src/data/panoramas');
const arquivo = process.argv[2];
if (!arquivo) {
  console.error('Informe a planilha: node scripts/panorama/extrair.mjs "dados/panorama-matricula/arquivo.xlsx"');
  process.exit(1);
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(arquivo);
const { panoramas, avisos } = lerLinhasPanorama(linhasDaAba(wb.worksheets[0]), basename(arquivo));
const cadastro = JSON.parse(readFileSync(join(RAIZ, 'src/data/planilha.json'), 'utf8')).unidades;

// Ligações já conferidas nos anos embutidos (o código da SEMEC não muda de um ano para o outro).
const anteriores = new Map();
for (const f of readdirSync(PASTA).filter((x) => x.endsWith('.json'))) {
  for (const u of expandir(JSON.parse(readFileSync(join(PASTA, f), 'utf8'))).unidades) if (u.unidade_id) anteriores.set(u.codigo, u.unidade_id);
}

for (const bruto of panoramas) {
  const p = associarUnidades(bruto, cadastro, anteriores);
  const n = contarPanorama(p);
  writeFileSync(join(PASTA, `${p.ano}.json`), JSON.stringify(compactar(p)) + '\n', 'utf8');
  console.log(`${p.ano}: ${n.unidades} unidades (${n.associadas} ligadas ao cadastro), ${n.turmas} turmas, ${n.alunos} alunos.`);
  for (const u of p.unidades.filter((x) => !x.unidade_id)) console.log(`  sem unidade no cadastro: ${u.codigo} ${u.nome} (INEP ${u.inep})`);
}
for (const a of avisos) console.log('Aviso: ' + a);
