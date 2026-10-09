// Extrai o texto de um PDF, página por página, na ordem em que o PDF o escreve.
import { readFile } from 'node:fs/promises';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

/** @returns {Promise<{ pagina: number, texto: string }[]>} */
export async function textoPorPagina(caminho) {
  const dados = new Uint8Array(await readFile(caminho));
  const doc = await pdfjs.getDocument({ data: dados, useSystemFonts: true, verbosity: 0 }).promise;
  const paginas = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pag = await doc.getPage(i);
    const conteudo = await pag.getTextContent();
    let texto = '';
    for (const it of conteudo.items) texto += it.str + (it.hasEOL ? '\n' : ' ');
    paginas.push({ pagina: i, texto });
    pag.cleanup();
  }
  await doc.destroy();
  return paginas;
}
