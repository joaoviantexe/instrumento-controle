import type { PaginaTexto } from './varreduraDiario';

type Pdfjs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let carregado: Promise<Pdfjs> | null = null;

/** Carrega o pdf.js só quando for usado (o arquivo é grande e só a varredura precisa dele). */
export function carregarPdfjs(): Promise<Pdfjs> {
  carregado ??= (async () => {
    const [pdfjs, worker] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  })();
  return carregado;
}

type TrabalhadorPdf = InstanceType<Pdfjs['PDFWorker']>;
const trabalhadores: TrabalhadorPdf[] = [];

/** Worker do pdf.js de uma "vaga" da varredura: reaproveitado em todas as edições, em vez de criar um por PDF. */
export function trabalhadorPdf(pdfjs: Pdfjs, vaga: number): TrabalhadorPdf {
  return (trabalhadores[vaga] ??= new pdfjs.PDFWorker());
}

/** Libera os workers (ao fim da varredura). */
export function encerrarTrabalhadores() {
  while (trabalhadores.length) trabalhadores.pop()?.destroy();
}

/** Texto de cada página do PDF, na ordem em que o PDF o escreve (uma linha por linha do documento). */
export async function extrairPaginas(pdfjs: Pdfjs, dados: ArrayBuffer, worker?: TrabalhadorPdf): Promise<PaginaTexto[]> {
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(dados), verbosity: 0, isEvalSupported: false, ...(worker ? { worker } : {}) });
  try {
    const doc = await tarefa.promise;
    const paginas: PaginaTexto[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const pag = await doc.getPage(i);
      const conteudo = await pag.getTextContent();
      let texto = '';
      for (const it of conteudo.items) if ('str' in it) texto += it.str + (it.hasEOL ? '\n' : ' ');
      paginas.push({ pagina: i, texto });
      pag.cleanup();
    }
    return paginas;
  } finally {
    // Também quando o PDF é inválido (a promessa rejeita): encerra a tarefa e o documento. O worker compartilhado continua vivo.
    await tarefa.destroy();
  }
}
