/**
 * Atualiza as resoluções do CME: busca a lista pública do site do Conselho (Prismic), acha as resoluções novas, liga cada uma às
 * unidades do cadastro (veja casar.mjs) e grava o resultado nos arquivos de dados do site.
 *
 * Uso (Node 20+):
 *   node scripts/cme/atualizar.mjs                 # grava os arquivos e escreve scripts/cme/ultimo-relatorio.md
 *   node scripts/cme/atualizar.mjs --seco          # só mostra o que faria
 *   node scripts/cme/atualizar.mjs --inicializar   # marca todas as resoluções de hoje como já conhecidas (uso único)
 *
 * Nada aqui usa IA nem guarda PDFs: só o endereço do PDF no site do CME. O que não for ligado com segurança vai para
 * src/data/atos-sem-unidade.json e aparece em Dados e planilhas → Conferência de atos.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { casarResolucao, citadasNoCadastro, ehNormaGeral, idDaResolucao, relacao } from './casar.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');
const ARQ = {
  resolucoes: join(RAIZ, 'src/data/resolucoes-cme.json'),
  semUnidade: join(RAIZ, 'src/data/atos-sem-unidade.json'),
  planilha: join(RAIZ, 'src/data/planilha.json'),
  conhecidas: join(AQUI, 'conhecidas.json'),
  relatorio: join(AQUI, 'ultimo-relatorio.md'),
};
const API = 'https://cme-website.prismic.io/api/v2';

const lerJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const gravarJson = (f, d) => writeFileSync(f, JSON.stringify(d, null, 1) + '\n', 'utf8');

async function buscar(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`${url} respondeu ${r.status}`);
  return r.json();
}

/** Lista de resoluções do site do CME: [{ano, titulo, descricao, documento}] */
export async function baixarResolucoes() {
  const api = await buscar(API);
  const ref = api.refs.find((x) => x.isMasterRef)?.ref ?? api.refs[0].ref;
  const q = encodeURIComponent('[[at(document.type,"todas_as_resolucoes")]]');
  const dados = await buscar(`${API}/documents/search?ref=${ref}&q=${q}&pageSize=1`);
  const lista = dados.results?.[0]?.data?.resolucoes_por_ano;
  if (!Array.isArray(lista) || lista.length < 100) throw new Error('A lista de resoluções veio vazia ou fora do formato esperado.');
  return lista;
}

const numeroDoTitulo = (titulo) => Number(/n[ºo°]?\s*(\d+)/i.exec(titulo ?? '')?.[1] ?? NaN);
const nomeDoArquivo = (doc) => String(doc?.name ?? '').replace(/\.pdf$/i, '');
const formatarNumero = (n) => (n < 100 ? String(n).padStart(2, '0') : String(n));

async function principal() {
  const seco = process.argv.includes('--seco');
  const inicializar = process.argv.includes('--inicializar');
  const lista = await baixarResolucoes();
  const idsDoSite = lista.map((x) => x.documento?.id).filter(Boolean);

  if (inicializar) {
    gravarJson(ARQ.conhecidas, [...new Set(idsDoSite)].sort());
    console.log(`${idsDoSite.length} resoluções marcadas como conhecidas.`);
    return;
  }

  const conhecidas = new Set(lerJson(ARQ.conhecidas));
  const novas = lista.filter((x) => x.documento?.id && !conhecidas.has(x.documento.id));
  console.log(`${lista.length} resoluções no site do CME; ${novas.length} novas desde a última vez.`);

  const dados = lerJson(ARQ.resolucoes);
  const semUnidade = lerJson(ARQ.semUnidade);
  const unidades = lerJson(ARQ.planilha).unidades;
  const citadas = citadasNoCadastro(unidades);
  const usados = new Set(dados.resolucoes.map((r) => r.id));

  const ligadas = [];
  const soltas = [];
  const ignoradas = [];
  for (const x of novas) {
    const numero = numeroDoTitulo(x.titulo);
    const ano = Number(x.ano);
    const url = x.documento?.url;
    const descricao = String(x.descricao ?? '').trim();
    if (!url || !Number.isInteger(numero) || !Number.isInteger(ano)) {
      ignoradas.push({ titulo: x.titulo, motivo: 'sem PDF ou sem número' });
      continue;
    }
    // Só interessa o que trata de funcionamento de uma escola; normas gerais e validação de estudos ficam de fora.
    if (relacao(descricao) === null || ehNormaGeral(descricao)) {
      ignoradas.push({ titulo: `Resolução nº ${formatarNumero(numero)}/${ano}`, motivo: 'norma geral ou assunto que não é funcionamento de escola' });
      continue;
    }
    const vinculos = casarResolucao({ ano, numero, descricao, arquivo: nomeDoArquivo(x.documento) }, unidades, citadas);
    if (vinculos.length) {
      const id = idDaResolucao(ano, numero, usados);
      ligadas.push({ id, ano, numero: formatarNumero(numero), descricao, url, unidades: vinculos });
    } else {
      soltas.push({
        id: `cme-${ano}-${String(numero).padStart(3, '0')}`,
        fonte: 'cme',
        titulo: `Resolução nº ${formatarNumero(numero)}/${ano} - CME`,
        descricao,
        url,
        referencia: 'Site do CME',
        motivo: 'Nenhuma unidade do cadastro corresponde: pode ser entidade ou escola de outra rede, ou uma unidade ainda não cadastrada.',
      });
    }
  }

  const nomeDe = new Map(unidades.map((u) => [u.id, u.nome]));
  const linhas = [
    `# Resoluções novas do CME (${new Date().toISOString().slice(0, 10)})`,
    '',
    `O site do CME tem ${lista.length} resoluções; ${novas.length} são novas desde a última atualização.`,
    '',
    `- **${ligadas.length}** ligadas a unidades (as com confiança "provável" ou "a conferir" aparecem em *Dados e planilhas → Conferência de atos*).`,
    `- **${soltas.length}** sem unidade no cadastro (entram na lista "Atos achados sem unidade no cadastro").`,
    `- ${ignoradas.length} ignoradas (normas gerais, validação de estudos etc.).`,
    '',
  ];
  if (ligadas.length) {
    linhas.push('## Ligadas', '', '| Resolução | Unidade | Relação | Confiança |', '|---|---|---|---|');
    for (const r of ligadas)
      for (const v of r.unidades) linhas.push(`| [${r.numero}/${r.ano}](${r.url}) | ${nomeDe.get(v.id)} (${v.id}) | ${v.relacao} | ${v.confianca} |`);
    linhas.push('');
  }
  if (soltas.length) {
    linhas.push('## Sem unidade no cadastro', '');
    for (const r of soltas) linhas.push(`- [${r.titulo}](${r.url}): ${r.descricao}`);
    linhas.push('');
  }
  const relatorio = linhas.join('\n');
  console.log(relatorio);

  if (seco) return;
  writeFileSync(ARQ.relatorio, relatorio, 'utf8'); // sempre: o passo do pull request lê este arquivo
  if (!novas.length) {
    console.log('Nada novo: nenhum arquivo alterado.');
    return;
  }
  dados.resolucoes = [...dados.resolucoes, ...ligadas].sort((a, b) => a.ano - b.ano || a.id.localeCompare(b.id));
  dados.atualizado_em = new Date().toISOString().slice(0, 10);
  semUnidade.itens = [...semUnidade.itens, ...soltas.filter((s) => !semUnidade.itens.some((i) => i.id === s.id))];
  semUnidade.atualizado_em = dados.atualizado_em;
  gravarJson(ARQ.resolucoes, dados);
  gravarJson(ARQ.semUnidade, semUnidade);
  gravarJson(ARQ.conhecidas, [...new Set([...conhecidas, ...idsDoSite])].sort());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  principal().catch((e) => {
    console.error('Falhou:', e.message);
    process.exit(1);
  });
}
