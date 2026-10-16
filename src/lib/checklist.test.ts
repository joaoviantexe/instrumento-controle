import { describe, expect, it } from 'vitest';
import { avaliacaoPadrao } from './calc';
import {
  ITENS_CHECKLIST,
  SECOES_CHECKLIST,
  MARCA_CDE,
  MARCA_VERIFICADO,
  VERIFICACAO_FEITA,
  VERIFICACAO_PENDENTE,
  auditoriaDeReferencia,
  consolidar,
  divergeDaDeclaracao,
  itemPorRotulo,
  lerSituacao,
  pendentesDaTurma,
  planejarAplicacao,
  registrosDaAplicacao,
  respostasComDados,
  type RespostaItem,
} from './checklist';
import type { Avaliacao, SituacaoItem } from './types';

const r = (situacao: SituacaoItem, observacao = ''): RespostaItem => ({ situacao, atualizado: '', prazo: '', responsavel: '', observacao });
const META = { ano: 2026, arquivo: 'checklist.xlsx', data: '2026-10-16' };

describe('modelo da checklist', () => {
  it('tem as 5 seções e os 34 itens das seções 1 a 5 da Lista Mestra, com os nomes do modelo', () => {
    expect(SECOES_CHECKLIST.map((s) => s.itens.length)).toEqual([7, 8, 9, 5, 5]);
    expect(ITENS_CHECKLIST[0]).toEqual({ codigo: 'INS-01', rotulo: 'Ato de criação da escola' });
    expect(ITENS_CHECKLIST.find((i) => i.codigo === 'SEC-01')?.rotulo).toBe('Livro/Pasta de Matrícula dos Alunos');
  });

  it('acha o item pelo texto, com o da Lista Mestra e desempatando pela seção', () => {
    expect(itemPorRotulo('LIVRO DE MATRÍCULA')).toBe('SEC-01');
    expect(itemPorRotulo('Pasta individual')).toBe('EST-03');
    expect(itemPorRotulo('Relação nominal dos estudantes', 1)).toBe('SEC-06');
    expect(itemPorRotulo('Relação nominal dos estudantes', 4)).toBe('ADM-02');
    expect(itemPorRotulo('Correspondências oficiais', 4)).toBe('ADM-04');
    expect(itemPorRotulo('Outra coisa')).toBeNull();
  });

  it('entende a situação escrita de vários jeitos', () => {
    expect(lerSituacao('CONFORME')).toBe('Conforme');
    expect(lerSituacao('nao conforme')).toBe('Não conforme');
    expect(lerSituacao('N/A')).toBe('Não se aplica');
    expect(lerSituacao('')).toBe('Não avaliado');
    expect(lerSituacao('talvez')).toBeNull();
  });

  it('conta as pendências da turma como a fórmula do título (Não conforme + Não avaliado)', () => {
    expect(pendentesDaTurma({})).toBe(34);
    expect(pendentesDaTurma({ 'INS-01': r('Conforme'), 'INS-02': r('Não se aplica'), 'INS-03': r('Não conforme') })).toBe(32);
  });
});

describe('consolidação das turmas', () => {
  const turmas = {
    T1: { 'INS-01': r('Conforme'), 'INS-02': r('Conforme'), 'INS-03': r('Não conforme', 'sem ato'), 'INS-04': r('Não se aplica'), 'INS-05': r('Conforme') },
    T2: { 'INS-01': r('Conforme'), 'INS-02': r('Não conforme'), 'INS-03': r('Não conforme'), 'INS-04': r('Não se aplica'), 'INS-06': r('Não conforme') },
  };
  const c = consolidar({ turmas });

  it('aplica as regras de cada situação', () => {
    expect(c.get('INS-01')?.situacao).toBe('Conforme');
    expect(c.get('INS-02')?.situacao).toBe('Parcialmente conforme');
    expect(c.get('INS-03')).toMatchObject({ situacao: 'Não conforme', naoConformes: ['T1', 'T2'], observacoes: ['T1: sem ato'] });
    expect(c.get('INS-04')?.situacao).toBe('Não se aplica');
    expect(c.get('INS-05')).toMatchObject({ situacao: 'Parcialmente conforme', semResposta: ['T2'] });
    expect(c.get('INS-06')?.situacao).toBe('Não conforme');
    expect(c.get('INS-07')?.situacao).toBe('Não avaliado');
  });

  it('turma do panorama que não veio na planilha conta como não avaliada', () => {
    const c2 = consolidar({ turmas: { T1: { 'INS-01': r('Conforme') } } }, ['T1', 'T3']);
    expect(c2.get('INS-01')).toMatchObject({ situacao: 'Parcialmente conforme', turmas: 2, semResposta: ['T3'] });
  });
});

describe('aplicação na Auditoria Documental', () => {
  const av = (item: string, extra: Partial<Avaliacao>): Avaliacao => ({ ...avaliacaoPadrao('AUD-001', item), ...extra });
  const c = consolidar({ turmas: { T1: { 'INS-01': r('Conforme'), 'INS-02': r('Não conforme'), 'INS-03': r('Conforme'), 'INS-04': r('Conforme'), 'INS-05': r('Conforme') } } });
  const atuais = new Map([
    // CDE avaliou: não muda, mas a declaração diferente fica registrada.
    ['INS-02', av('INS-02', { situacao: 'Conforme', achado: 'conferido' })],
    // Autodeclaração anterior ainda pendente: é atualizada.
    ['INS-03', av('INS-03', { situacao: 'Não conforme', declarado: 'Não conforme', verificacao: VERIFICACAO_PENDENTE })],
    // Já verificada pela CDE: a CDE prevalece.
    ['INS-04', av('INS-04', { situacao: 'Não conforme', declarado: 'Não conforme', verificacao: VERIFICACAO_FEITA })],
  ]);
  const plano = planejarAplicacao(c, 'AUD-001', atuais, META);
  const de = (codigo: string) => plano.find((m) => m.codigo === codigo)!;

  it('item não avaliado recebe a declaração, marcado para a CDE verificar', () => {
    expect(de('INS-01').acao).toBe('aplicar');
    expect(de('INS-01').depois).toMatchObject({ situacao: 'Conforme', declarado: 'Conforme', verificacao: VERIFICACAO_PENDENTE });
    expect(de('INS-01').depois.declaracao).toContain('Conforme em 1 de 1 turma(s)');
    expect(de('INS-03').acao).toBe('aplicar');
    expect(de('INS-03').depois.situacao).toBe('Conforme');
  });

  it('nunca substitui o que a CDE avaliou ou verificou', () => {
    expect(de('INS-02')).toMatchObject({ acao: 'manter', diverge: true });
    expect(de('INS-02').depois).toMatchObject({ situacao: 'Conforme', achado: 'conferido', declarado: 'Não conforme' });
    expect(de('INS-02').depois.verificacao).toBeUndefined();
    expect(divergeDaDeclaracao(de('INS-02').depois)).toBe(true);
    expect(de('INS-04')).toMatchObject({ acao: 'manter', diverge: true });
    expect(de('INS-04').depois).toMatchObject({ situacao: 'Não conforme', verificacao: VERIFICACAO_FEITA, declarado: 'Conforme' });
  });

  it('itens sem declaração ficam de fora; reaplicar a mesma planilha não muda nada', () => {
    expect(de('INS-06').acao).toBe('sem-declaracao');
    const gravar = registrosDaAplicacao(plano);
    expect(gravar.map((a) => a.item)).toEqual(['INS-01', 'INS-02', 'INS-03', 'INS-04', 'INS-05']);
    const depois = new Map(gravar.map((a) => [a.item, a]));
    for (const [k, v] of atuais) if (!depois.has(k)) depois.set(k, v);
    const denovo = planejarAplicacao(c, 'AUD-001', depois, META);
    expect(registrosDaAplicacao(denovo)).toEqual([]);
    expect(denovo.filter((m) => m.acao !== 'sem-declaracao').every((m) => m.acao === 'igual')).toBe(true);
  });
});

describe('planilha com dados', () => {
  const av = (item: string, extra: Partial<Avaliacao>): Avaliacao => ({ ...avaliacaoPadrao('AUD-001', item), ...extra });
  const salvas = {
    T1: { 'INS-01': r('Não conforme', 'falta'), 'INS-02': r('Conforme'), 'INS-03': r('Conforme'), 'INS-04': r('Conforme') },
    T2: { 'INS-01': r('Não conforme'), 'INS-02': r('Não conforme'), 'INS-03': r('Conforme') },
  };
  const avaliacoes = new Map([
    ['INS-01', av('INS-01', { situacao: 'Conforme' })], // CDE avaliou: vale para todas as turmas
    ['INS-02', av('INS-02', { situacao: 'Parcialmente conforme', verificacao: VERIFICACAO_FEITA })], // bate com as turmas: mantém o detalhe
    ['INS-03', av('INS-03', { situacao: 'Conforme', declarado: 'Conforme', verificacao: VERIFICACAO_PENDENTE })], // autodeclarado: fica a secretaria
  ]);
  const saida = respostasComDados(['T1', 'T2', 'T3'], salvas, avaliacoes);

  it('a avaliação da CDE vale para todas as turmas, com a marca na observação (a da secretaria fica)', () => {
    expect(saida.T1['INS-01']).toMatchObject({ situacao: 'Conforme', observacao: 'falta' });
    expect(saida.T2['INS-01']).toMatchObject({ situacao: 'Conforme', observacao: MARCA_CDE });
    expect(saida.T3['INS-01']).toMatchObject({ situacao: 'Conforme', observacao: MARCA_CDE });
  });

  it('mantém o detalhe por turma quando ele já resulta na situação da CDE; o que a CDE não avaliou fica como a secretaria respondeu', () => {
    expect(saida.T1['INS-02'].situacao).toBe('Conforme');
    expect(saida.T2['INS-02'].situacao).toBe('Não conforme');
    expect(saida.T3['INS-02']).toBeUndefined();
    expect(saida.T1['INS-03'].situacao).toBe('Conforme');
    expect(saida.T1['INS-04'].situacao).toBe('Conforme');
    expect(saida.T2['INS-04']).toBeUndefined();
  });

  it('sem respostas da secretaria, sai só o que a CDE avaliou; verificado leva a marca de verificado', () => {
    const s2 = respostasComDados(['T1'], undefined, avaliacoes);
    expect(Object.keys(s2.T1).sort()).toEqual(['INS-01', 'INS-02']);
    expect(s2.T1['INS-02']).toMatchObject({ situacao: 'Parcialmente conforme', observacao: MARCA_VERIFICADO });
  });

  it('reaplicar a planilha com dados não cria divergência com a CDE', () => {
    const c = consolidar({ turmas: saida }, ['T1', 'T2', 'T3']);
    const plano = planejarAplicacao(c, 'AUD-001', avaliacoes, META);
    expect(plano.filter((m) => m.diverge)).toEqual([]);
  });

  it('auditoria de referência: a mais recente com itens avaliados', () => {
    const auds = [
      { id: 'AUD-001', unidade_id: 'UN-1', iniciada: true },
      { id: 'AUD-300', unidade_id: 'UN-1', iniciada: false },
      { id: 'AUD-200', unidade_id: 'UN-1', iniciada: true },
      { id: 'AUD-400', unidade_id: 'UN-2', iniciada: true },
    ];
    expect(auditoriaDeReferencia(auds, 'UN-1')?.id).toBe('AUD-200');
    expect(auditoriaDeReferencia(auds, 'UN-9')).toBeUndefined();
  });
});
