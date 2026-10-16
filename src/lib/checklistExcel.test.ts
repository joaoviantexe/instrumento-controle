import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { UNIDADES_INICIAIS } from '../data/planilha';
import { carregarPanoramaEmbutido } from '../data/panoramas';
import { ITENS_CHECKLIST, MARCA_CDE, SECOES_GERAL, SECOES_TURMA, type RespostaItem } from './checklist';
import { ABA_GERAL, diferencasCadastro, lerChecklistDaPasta, montarChecklist, nomeAbaTurma, nomeArquivoChecklist, normalizarXlsx } from './checklistExcel';

const MODELO = 'dados/modelos/Checklist_Secretaria_Escolar.xlsx';

async function abrir(caminho: string | ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  const dados = typeof caminho === 'string' ? new Uint8Array(readFileSync(caminho)).buffer : caminho;
  await wb.xlsx.load(await normalizarXlsx(dados));
  return wb;
}

/** Escola do modelo: EM Ruy da Silveira Britto (INEP 15040968), 19 turmas em 2026. */
async function dadosRuy() {
  const unidade = UNIDADES_INICIAIS.find((u) => u.inep === '15040968')!;
  const p = (await carregarPanoramaEmbutido(2026))!;
  const panorama = p.unidades.find((u) => u.unidade_id === unidade.id)!;
  return { unidade, ano: 2026, turmas: panorama.turmas, panorama };
}

const gerar = async (d: Parameters<typeof montarChecklist>[1]) => abrir((await montarChecklist(ExcelJS, d).xlsx.writeBuffer()) as ArrayBuffer);
const coluna = (wb: ExcelJS.Workbook, aba: string, col: string, ate: number) => Array.from({ length: ate }, (_, i) => wb.getWorksheet(aba)!.getCell(`${col}${i + 1}`).text);
const r = (situacao: RespostaItem['situacao'], extra: Partial<RespostaItem> = {}): RespostaItem => ({ situacao, atualizado: '', prazo: '', responsavel: '', observacao: '', ...extra });
/** A planilha preenche o Responsável com o diretor quando ele está vazio (como o modelo). */
const comDiretor = (resp: Record<string, RespostaItem>, diretor: string) => Object.fromEntries(Object.entries(resp).map(([k, v]) => [k, { ...v, responsavel: v.responsavel || diretor }]));

describe('Checklist da Secretaria Escolar (Excel)', () => {
  it('segue o modelo: Unidade, Turmas, a checklist geral e uma checklist por turma', async () => {
    const modelo = await abrir(MODELO);
    const d = await dadosRuy();
    const gerado = await gerar(d);
    if (process.env.CHECKLIST_SAIDA) writeFileSync(process.env.CHECKLIST_SAIDA, Buffer.from(await gerado.xlsx.writeBuffer()));

    const nomesModelo = modelo.worksheets.map((w) => w.name);
    expect(gerado.worksheets.map((w) => w.name)).toEqual([...nomesModelo.slice(0, 2), ABA_GERAL, ...nomesModelo.slice(2)]);
    expect(coluna(gerado, 'Unidade', 'A', 20)).toEqual(coluna(modelo, 'Unidade', 'A', 20));
    expect(gerado.getWorksheet('Unidade')!.getCell('B2').text).toBe(d.unidade.nome);
    expect(gerado.getWorksheet('Unidade')!.getCell('B3').value).toBe(15040968);
    expect((gerado.getWorksheet('Turmas')!.getRow(1).values as unknown[]).slice(1, 4)).toEqual(['Ano', 'Distrito', 'Zona']);
    expect(gerado.getWorksheet('Turmas')!.rowCount).toBe(20);
    expect(gerado.definedNames.getRanges('Diretor').ranges).toEqual(['Unidade!$B$19']);

    // Aba geral: os 24 documentos da unidade, com as seções do modelo.
    const geral = gerado.getWorksheet(ABA_GERAL)!;
    expect(geral.getCell('A1').text).toBe('Checklist Geral da Unidade / 24 itens pendentes');
    const esperadoGeral = SECOES_GERAL.flatMap((s) => [s.titulo, ...s.itens.map((i) => i.rotulo)]);
    expect(coluna(gerado, ABA_GERAL, 'A', esperadoGeral.length + 1).slice(1)).toEqual(esperadoGeral);
    expect(geral.getCell('A3').text).toBe('Ato de criação da escola');

    // Aba da turma: só os 10 documentos da turma, com a mesma fórmula de título do modelo.
    const aba = nomeAbaTurma('C41302');
    const esperadoTurma = SECOES_TURMA.flatMap((s) => [s.titulo, ...s.itens.map((i) => i.rotulo)]);
    expect(coluna(gerado, aba, 'A', esperadoTurma.length + 2).slice(1)).toEqual([...esperadoTurma, '']);
    const formula = (wb: ExcelJS.Workbook) => (wb.getWorksheet(aba)!.getCell('A1').value as { formula: string }).formula;
    expect(formula(gerado)).toBe(formula(modelo).replace(/^=/, ''));
    expect(gerado.getWorksheet(aba)!.getCell('A1').text).toBe('CICLO IV - 1º ANO | TARDE | C41302 / 10 itens pendentes');
    expect(gerado.getWorksheet(aba)!.getCell('B3').dataValidation).toMatchObject({ type: 'list', formulae: ['"Conforme,Não conforme,Não se aplica,Não avaliado"'] });
    expect(gerado.getWorksheet(aba)!.getCell('E3').text).toBe(d.unidade.diretor);
  });

  it('lê o próprio arquivo gerado, com as respostas preenchidas', async () => {
    const d = await dadosRuy();
    const respostas = {
      geral: { 'INS-01': r('Conforme', { atualizado: '2026-10-01', responsavel: 'FULANA', observacao: 'Pasta 3' }), 'ADM-02': r('Não conforme', { prazo: '2026-12-15' }) },
      turmas: { C11101: { 'EST-01': r('Conforme') }, C11102: { 'SEC-06': r('Não conforme', { observacao: 'falta a lista' }) } },
    };
    const wb = await gerar({ ...d, respostas });
    expect(wb.getWorksheet(ABA_GERAL)!.getCell('A1').text).toBe('Checklist Geral da Unidade / 23 itens pendentes');
    expect(wb.getWorksheet(nomeAbaTurma('C11101'))!.getCell('A1').text).toBe('CICLO I - 1º ANO | MANHÃ | C11101 / 9 itens pendentes');
    const lida = lerChecklistDaPasta(wb);
    expect(lida.unidade).toEqual({ nome: d.unidade.nome, inep: '15040968' });
    expect(lida.ano).toBe(2026);
    expect(lida.avisos.filter((a) => !a.includes('nenhum dos'))).toEqual([]);
    const dir = d.unidade.diretor;
    expect(lida.geral).toEqual(comDiretor(respostas.geral, dir));
    expect(Object.keys(lida.turmas)).toHaveLength(19);
    expect(lida.turmas.C11101).toEqual(comDiretor(respostas.turmas.C11101, dir));
    expect(lida.turmas.C11102).toEqual(comDiretor(respostas.turmas.C11102, dir));
  });

  it('lê o modelo original (todos os itens em cada turma, sem a coluna oculta de códigos)', async () => {
    const modelo = await abrir(MODELO);
    // Simula o preenchimento da secretaria no próprio modelo.
    const ws = modelo.getWorksheet(nomeAbaTurma('C41302'))!;
    ws.getCell('B3').value = 'Conforme'; // Ato de criação (da unidade)
    ws.getCell('B20').value = 'Conforme'; // Fichas de matrícula (da turma)
    ws.getCell('B37').value = 'não conforme'; // Relação nominal dos estudantes (Administrativos, da unidade)
    ws.getCell('F37').value = 'Falta a lista da turma';
    modelo.getWorksheet(nomeAbaTurma('C11101'))!.getCell('B16').value = 'Não conforme'; // Relação nominal (Secretaria, da turma)
    const lida = lerChecklistDaPasta(modelo);
    expect(lida.avisos).toEqual(expect.not.arrayContaining([expect.stringContaining('não corresponde')]));
    expect(lida.avisos).toEqual(expect.arrayContaining([expect.stringContaining('formato antigo')]));
    expect(Object.keys(lida.turmas)).toHaveLength(19);
    expect(lida.geral['INS-01'].situacao).toBe('Conforme');
    expect(lida.geral['ADM-02']).toMatchObject({ situacao: 'Não conforme', observacao: 'C41302: Falta a lista da turma' });
    expect(lida.turmas.C41302).toEqual({ 'EST-01': r('Conforme', { responsavel: 'ROSEANE CONCEIÇÃO COUTO VOGADO' }) });
    expect(lida.turmas.C11101['SEC-06'].situacao).toBe('Não conforme');
    expect(lida.turmas.C11102).toEqual({});
  });

  it('unidade sem turmas no panorama: só a checklist geral, com os 34 documentos', async () => {
    const unidade = UNIDADES_INICIAIS[0];
    const wb = await gerar({ unidade, ano: 2027, turmas: [], respostas: { geral: { 'EST-01': r('Conforme') }, turmas: {} } });
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Unidade', 'Turmas', ABA_GERAL]);
    expect(wb.getWorksheet(ABA_GERAL)!.getCell('A1').text).toBe(`Checklist Geral da Unidade / ${ITENS_CHECKLIST.length - 1} itens pendentes`);
    expect(lerChecklistDaPasta(wb)).toMatchObject({ geral: comDiretor({ 'EST-01': r('Conforme') }, unidade.diretor), turmas: {} });
  });

  it('a aba Unidade volta para o Cadastro só com o que mudou (sem nome e INEP, sem apagar)', async () => {
    const d = await dadosRuy();
    const wb = await gerar(d);
    // A planilha recém-gerada não traz diferença nenhuma.
    expect(diferencasCadastro(d.unidade, lerChecklistDaPasta(wb).cadastro)).toEqual([]);
    const ws = wb.getWorksheet('Unidade')!;
    ws.getCell('B2').value = 'OUTRO NOME';
    ws.getCell('B19').value = 'Maria da Silva';
    ws.getCell('B16').value = '(91) 3333-4444';
    ws.getCell('B12').value = null;
    const lida = lerChecklistDaPasta(wb);
    expect(lida.unidade.nome).toBe('OUTRO NOME');
    expect(diferencasCadastro(d.unidade, lida.cadastro)).toEqual([
      { campo: 'telefone', rotulo: 'Telefone', de: d.unidade.telefone, para: '9133334444' },
      { campo: 'diretor', rotulo: 'Diretor', de: d.unidade.diretor, para: 'MARIA DA SILVA' },
    ]);
  });

  it('a marca "Avaliado pela CDE" da planilha com dados não volta como observação da secretaria', async () => {
    const d = await dadosRuy();
    const wb = await gerar({ ...d, respostas: { geral: { 'INS-01': r('Conforme', { observacao: MARCA_CDE }) }, turmas: { C11101: { 'EST-01': r('Conforme', { observacao: MARCA_CDE }) } } } });
    expect(wb.getWorksheet(ABA_GERAL)!.getCell('F3').text).toBe(MARCA_CDE);
    const lida = lerChecklistDaPasta(wb);
    expect(lida.geral['INS-01']).toEqual(r('Conforme', { responsavel: d.unidade.diretor }));
    expect(lida.turmas.C11101['EST-01']).toEqual(r('Conforme', { responsavel: d.unidade.diretor }));
  });

  it('nome do arquivo sem acentos nem espaços', () => {
    expect(nomeArquivoChecklist({ nome: 'ESCOLA MUNICIPAL SÃO JOÃO' }, 2026)).toBe('Checklist_Secretaria_Escolar_2026_ESCOLA_MUNICIPAL_SAO_JOAO.xlsx');
  });
});
