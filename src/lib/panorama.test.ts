import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { UNIDADES_INICIAIS } from '../data/planilha';
import { ANOS_EMBUTIDOS, carregarPanoramaEmbutido } from '../data/panoramas';
import {
  agruparTurmas,
  associarUnidades,
  compactar,
  compararAnos,
  decodificarTurma,
  expandir,
  lerLinhasPanorama,
  linhasDaAba,
  resumirTurmas,
  type Turma,
} from './panorama';

const ARQUIVO = 'dados/panorama-matricula/sc_xls_20261015082336_349_conPanoramaMatricula_1.xlsx';

const turma = (codigo: string, alunos = 20, ocupacao = 25, ensino = 'ENSINO FUNDAMENTAL'): Turma => ({
  ensino,
  serie: 'CICLO I - 1º ANO',
  turno: 'MANHÃ',
  turma: codigo,
  ocupacao,
  alunos,
  nao_especial: alunos,
  especial: 0,
  ocupacao_especial: 0,
  vagas: ocupacao - alunos,
});

describe('Panorama de Matrícula', () => {
  it('a planilha de 2026 gera exatamente o arquivo embutido, com as 217 unidades ligadas ao cadastro', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(readFileSync(ARQUIVO) as unknown as ArrayBuffer);
    const { panoramas, avisos } = lerLinhasPanorama(linhasDaAba(wb.worksheets[0] as never), 'sc_xls_20261015082336_349_conPanoramaMatricula_1.xlsx');
    expect(avisos).toEqual([]);
    expect(panoramas.map((p) => p.ano)).toEqual([2026]);
    const p = associarUnidades(panoramas[0], UNIDADES_INICIAIS);
    expect(p.unidades).toHaveLength(217);
    expect(p.unidades.every((u) => u.unidade_id)).toBe(true);
    expect(new Set(p.unidades.map((u) => u.unidade_id)).size).toBe(217);

    expect(ANOS_EMBUTIDOS).toContain(2026);
    const embutido = await carregarPanoramaEmbutido(2026);
    expect(embutido).toEqual(p);
  });

  it('anexo e sede com o mesmo INEP vão para as unidades certas', async () => {
    const p = (await carregarPanoramaEmbutido(2026))!;
    const porCodigo = new Map(p.unidades.map((u) => [u.codigo, u]));
    expect(porCodigo.get('29')?.unidade_id).toBe('UN-016'); // EM Francisco da Silva Nunes
    expect(porCodigo.get('232')?.unidade_id).toBe('UN-002'); // seu anexo Barão de Mamoré
    const ruy = p.unidades.find((u) => u.inep === '15040968')!;
    expect(ruy.turmas.map((t) => t.turma)).toEqual([
      'C11101', 'C11102', 'C12101', 'C12102', 'C13101', 'C13102', 'C21101', 'C21102', 'C22101', 'C22102',
      'C31301', 'C31302', 'C32301', 'C32302', 'C41301', 'C41302', 'C41303', 'C42301', 'C42302',
    ]);
  });

  it('compacta e expande sem perder nada', async () => {
    const p = (await carregarPanoramaEmbutido(2026))!;
    expect(expandir(compactar(p))).toEqual(p);
  });

  it('lê planilhas sem a coluna Ano (usa o ano informado) e calcula vagas ausentes', () => {
    const { panoramas } = lerLinhasPanorama(
      [
        ['Relatório'],
        ['Unidade', 'COD INEP', 'Turma', 'Série', 'Qt Ocupação Turma', 'Qt Alunos Turma'],
        ['EM TESTE', 15000000, 'c11301', 'CICLO I - 1º ANO', 25, 27],
        [null, null, null],
      ],
      'teste.xlsx',
      2027,
    );
    expect(panoramas[0].ano).toBe(2027);
    expect(panoramas[0].unidades[0].turmas[0]).toMatchObject({ turma: 'C11301', turno: 'TARDE', vagas: -2 });
  });

  it('recusa planilhas sem os cabeçalhos do panorama', () => {
    expect(() => lerLinhasPanorama([['Nome', 'Endereço']], 'x.xlsx', 2026)).toThrow(/cabeçalhos/);
  });

  it('não liga duas unidades do panorama à mesma unidade do cadastro, e só pelo nome quando é bem parecido', () => {
    const cadastro = [
      { id: 'UN-1', inep: '111', nome: 'ESCOLA MUNICIPAL ALFA' },
      { id: 'UN-2', inep: '222', nome: 'ESCOLA MUNICIPAL BETA' },
    ];
    const base = { distrito: '', zona: '', bairro: '', tipo_contrato: '', rede: '', unidade_id: '', turmas: [] };
    const p = associarUnidades(
      {
        ano: 2026,
        fonte: '',
        unidades: [
          { ...base, codigo: '1', inep: '111', nome: 'ESCOLA MUNICIPAL ALFA' },
          { ...base, codigo: '2', inep: '999', nome: 'ESCOLA MUNICIPAL ALFA (NOVA)' },
          { ...base, codigo: '3', inep: '999', nome: 'CRECHE GAMA' },
          { ...base, codigo: '4', inep: '', nome: 'ESCOLA MUNICIPAL BETA' },
        ],
      },
      cadastro,
    );
    expect(p.unidades.map((u) => u.unidade_id)).toEqual(['UN-1', '', '', 'UN-2']);
  });

  it('a ligação de um ano anterior tem prioridade (o código da SEMEC não muda)', () => {
    const cadastro = [{ id: 'UN-9', inep: '1', nome: 'NOME ANTIGO' }];
    const p = associarUnidades(
      { ano: 2027, fonte: '', unidades: [{ codigo: '77', inep: '5', nome: 'NOME NOVO', distrito: '', zona: '', bairro: '', tipo_contrato: '', rede: '', unidade_id: '', turmas: [] }] },
      cadastro,
      new Map([['77', 'UN-9']]),
    );
    expect(p.unidades[0].unidade_id).toBe('UN-9');
  });
});

describe('turmas', () => {
  it('decodifica o código do SIGA', () => {
    expect(decodificarTurma('C41302')).toEqual({ etapa: 'Ciclo', turno: 'TARDE', numero: 2 });
    expect(decodificarTurma('J22501')).toEqual({ etapa: 'Jardim', turno: 'TEMPO INTEGRAL', numero: 1 });
    expect(decodificarTurma('T44401')?.turno).toBe('NOITE');
    expect(decodificarTurma('XYZ')).toBeNull();
  });

  it('resume, agrupa e compara anos', () => {
    const atual = [turma('C11101', 30, 25), turma('C11102'), turma('J11101', 10, 20, 'EDUCAÇÃO INFANTIL')];
    const r = resumirTurmas(atual);
    expect(r).toMatchObject({ turmas: 3, alunos: 60, capacidade: 70, superlotadas: 1 });
    expect(r.ocupacao).toBeCloseTo(60 / 70);
    expect(agruparTurmas(atual).map((g) => g.ensino)).toEqual(['EDUCAÇÃO INFANTIL', 'ENSINO FUNDAMENTAL']);
    expect(compararAnos(atual, [turma('C11101'), turma('C11103')])).toEqual({ novas: ['C11102', 'J11101'], encerradas: ['C11103'], alunos: 20 });
  });
});
