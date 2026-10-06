import { avisar } from './avisos';
import { hojeISO } from './format';

export type TipoColuna = 'texto' | 'numero' | 'pct' | 'data';
export interface Coluna {
  cabecalho: string;
  largura?: number;
  tipo?: TipoColuna;
}
export type Celula = string | number | null | undefined;
export interface Aba {
  nome: string;
  titulo?: string;
  subtitulo?: string;
  colunas: Coluna[];
  linhas: Celula[][];
}

const AZUL = 'FF0F265C';

function paraData(v: Celula): Date | Celula {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [a, m, d] = v.split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, d));
  }
  return v;
}

/** Gera um arquivo .xlsx com uma aba por tabela (biblioteca carregada só quando necessário). */
export async function exportarExcel(nomeArquivo: string, abas: Aba[]) {
  try {
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Instrumento de Controle da Documentação Escolar — CDE/SEMEC';
    wb.created = new Date();

    for (const aba of abas) {
      const ws = wb.addWorksheet(aba.nome.slice(0, 31));
      let linhaCab = 1;
      if (aba.titulo) {
        ws.addRow([aba.titulo]).font = { bold: true, size: 14, color: { argb: AZUL } };
        ws.mergeCells(1, 1, 1, Math.max(1, aba.colunas.length));
        linhaCab++;
        if (aba.subtitulo) {
          ws.addRow([aba.subtitulo]).font = { italic: true, color: { argb: 'FF45474B' } };
          ws.mergeCells(2, 1, 2, Math.max(1, aba.colunas.length));
          linhaCab++;
        }
        ws.addRow([]);
        linhaCab++;
      }
      const cab = ws.addRow(aba.colunas.map((c) => c.cabecalho));
      cab.eachCell((c) => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
        c.alignment = { vertical: 'middle', wrapText: true };
      });
      cab.height = 30;
      for (const linha of aba.linhas) {
        ws.addRow(linha.map((v, i) => (aba.colunas[i]?.tipo === 'data' ? paraData(v) : (v ?? ''))));
      }
      aba.colunas.forEach((c, i) => {
        const col = ws.getColumn(i + 1);
        col.width = c.largura ?? Math.min(60, Math.max(10, c.cabecalho.length + 4));
        if (c.tipo === 'pct') col.numFmt = '0.0%';
        if (c.tipo === 'data') col.numFmt = 'dd/mm/yyyy';
      });
      ws.views = [{ state: 'frozen', ySplit: linhaCab }];
      if (aba.linhas.length) {
        ws.autoFilter = {
          from: { row: linhaCab, column: 1 },
          to: { row: linhaCab + aba.linhas.length, column: aba.colunas.length },
        };
      }
    }

    const buffer = await wb.xlsx.writeBuffer();
    baixar(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `${nomeArquivo}_${hojeISO()}.xlsx`,
    );
    avisar('Planilha exportada.');
  } catch (e) {
    avisar('Não foi possível exportar: ' + (e as Error).message, 'erro');
  }
}

export function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
