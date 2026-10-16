import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { UNIDADES_INICIAIS } from '../data/planilha';
import { carregarPanoramaEmbutido } from '../data/panoramas';
import { ITENS_CHECKLIST, MARCA_CDE } from './checklist';
import { diferencasCadastro, lerChecklistDaPasta, montarChecklist, nomeAbaTurma, nomeArquivoChecklist, normalizarXlsx } from './checklistExcel';

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

describe('Checklist da Secretaria Escolar (Excel)', () => {
  it('gera as mesmas abas, colunas e textos do modelo', async () => {
    const modelo = await abrir(MODELO);
    const d = await dadosRuy();
    const gerado = await abrir((await montarChecklist(ExcelJS, d).xlsx.writeBuffer()) as ArrayBuffer);
    if (process.env.CHECKLIST_SAIDA) writeFileSync(process.env.CHECKLIST_SAIDA, Buffer.from(await gerado.xlsx.writeBuffer()));

    expect(gerado.worksheets.map((w) => w.name)).toEqual(modelo.worksheets.map((w) => w.name));

    const coluna = (wb: ExcelJS.Workbook, aba: string, col: string, ate: number) =>
      Array.from({ length: ate }, (_, i) => wb.getWorksheet(aba)!.getCell(`${col}${i + 1}`).text);
    expect(coluna(gerado, 'Unidade', 'A', 20)).toEqual(coluna(modelo, 'Unidade', 'A', 20));
    expect(gerado.getWorksheet('Unidade')!.getCell('B2').text).toBe(d.unidade.nome);
    expect(gerado.getWorksheet('Unidade')!.getCell('B3').value).toBe(15040968);

    const cab = (wb: ExcelJS.Workbook) => (wb.getWorksheet('Turmas')!.getRow(1).values as unknown[]).slice(1);
    expect(cab(gerado)).toEqual(['Ano', 'Distrito', 'Zona', 'Bairro', 'Tipo de Contrato', 'Rede', 'Código INEP', 'Código Unidade', 'Unidade', 'Ensino', 'Série', 'Turno', 'Turma', 'Qt Ocupação Turma', 'Qt Alunos Turma', 'Qt Aluno Não Especial', 'Qt Aluno Especial', 'Qt Ocupação Aluno Especial', 'Qt Vagas Restantes', 'Alunos', 'Nome Geral']);
    expect(gerado.getWorksheet('Turmas')!.rowCount).toBe(20);

    // Aba de turma: mesma coluna A (seções e itens) e mesma fórmula do título.
    const aba = nomeAbaTurma('C41302');
    expect(coluna(gerado, aba, 'A', 40).slice(1)).toEqual(coluna(modelo, aba, 'A', 40).slice(1));
    const formula = (wb: ExcelJS.Workbook) => (wb.getWorksheet(aba)!.getCell('A1').value as { formula: string }).formula;
    expect(formula(gerado)).toBe(formula(modelo).replace(/^=/, ''));
    expect(gerado.getWorksheet(aba)!.getCell('A1').text).toBe('CICLO IV - 1º ANO | TARDE | C41302 / 34 itens pendentes');
    expect(gerado.getWorksheet(aba)!.getCell('B3').dataValidation).toMatchObject({ type: 'list', formulae: ['"Conforme,Não conforme,Não se aplica,Não avaliado"'] });
    expect(gerado.getWorksheet(aba)!.getCell('E3').text).toBe(d.unidade.diretor);
    expect(gerado.definedNames.getRanges('Diretor').ranges).toEqual(['Unidade!$B$19']);
  });

  it('lê o próprio arquivo gerado, com as respostas preenchidas', async () => {
    const d = await dadosRuy();
    const respostas = {
      C11101: { 'INS-01': { situacao: 'Conforme' as const, atualizado: '2026-10-01', prazo: '', responsavel: 'FULANA', observacao: 'Pasta 3' } },
      C11102: { 'ADM-02': { situacao: 'Não conforme' as const, atualizado: '', prazo: '2026-12-15', responsavel: '', observacao: '' } },
    };
    const wb = await abrir((await montarChecklist(ExcelJS, { ...d, respostas }).xlsx.writeBuffer()) as ArrayBuffer);
    expect(wb.getWorksheet(nomeAbaTurma('C11101'))!.getCell('A1').text).toBe('CICLO I - 1º ANO | MANHÃ | C11101 / 33 itens pendentes');
    const lida = lerChecklistDaPasta(wb);
    expect(lida.unidade).toEqual({ nome: d.unidade.nome, inep: '15040968' });
    expect(lida.ano).toBe(2026);
    expect(Object.keys(lida.turmas)).toHaveLength(19);
    expect(lida.turmas.C11101['INS-01']).toEqual(respostas.C11101['INS-01']);
    // "Relação nominal dos estudantes" existe em duas seções: a resposta fica no item certo.
    expect(lida.turmas.C11102['ADM-02']).toMatchObject({ situacao: 'Não conforme', prazo: '2026-12-15' });
    expect(lida.turmas.C11102['SEC-06']).toBeUndefined();
  });

  it('lê o modelo original (sem a coluna oculta de códigos), pelo texto dos itens', async () => {
    const modelo = await abrir(MODELO);
    // Simula o preenchimento da secretaria no próprio modelo.
    const ws = modelo.getWorksheet(nomeAbaTurma('C41302'))!;
    ws.getCell('B3').value = 'Conforme';
    ws.getCell('B37').value = 'não conforme'; // Relação nominal dos estudantes (Administrativos)
    ws.getCell('F37').value = 'Falta a lista da turma';
    const lida = lerChecklistDaPasta(modelo);
    expect(lida.avisos).toEqual(expect.not.arrayContaining([expect.stringContaining('não corresponde')]));
    expect(Object.keys(lida.turmas)).toHaveLength(19);
    expect(lida.turmas.C41302['INS-01'].situacao).toBe('Conforme');
    expect(lida.turmas.C41302['ADM-02']).toMatchObject({ situacao: 'Não conforme', observacao: 'Falta a lista da turma' });
    expect(Object.keys(lida.turmas.C11101)).toEqual([]);
    expect(ITENS_CHECKLIST).toHaveLength(34);
  });

  it('unidade sem turmas no panorama ganha uma checklist geral', async () => {
    const unidade = UNIDADES_INICIAIS[0];
    const wb = await abrir((await montarChecklist(ExcelJS, { unidade, ano: 2027, turmas: [] }).xlsx.writeBuffer()) as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Unidade', 'Turmas', 'Checklist - GERAL']);
    expect(lerChecklistDaPasta(wb).turmas).toEqual({ GERAL: {} });
  });

  it('a aba Unidade volta para o Cadastro só com o que mudou (sem nome e INEP, sem apagar)', async () => {
    const d = await dadosRuy();
    const wb = await abrir((await montarChecklist(ExcelJS, d).xlsx.writeBuffer()) as ArrayBuffer);
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
    const respostas = { C11101: { 'INS-01': { situacao: 'Conforme' as const, atualizado: '', prazo: '', responsavel: '', observacao: MARCA_CDE } } };
    const wb = await abrir((await montarChecklist(ExcelJS, { ...d, respostas }).xlsx.writeBuffer()) as ArrayBuffer);
    expect(wb.getWorksheet(nomeAbaTurma('C11101'))!.getCell('F3').text).toBe(MARCA_CDE);
    expect(lerChecklistDaPasta(wb).turmas.C11101['INS-01']).toMatchObject({ situacao: 'Conforme', observacao: '' });
  });

  it('nome do arquivo sem acentos nem espaços', () => {
    expect(nomeArquivoChecklist({ nome: 'ESCOLA MUNICIPAL SÃO JOÃO' }, 2026)).toBe('Checklist_Secretaria_Escolar_2026_ESCOLA_MUNICIPAL_SAO_JOAO.xlsx');
  });
});
