import { describe, expect, it } from 'vitest';
import { avaliacaoPadrao } from './calc';
import {
  ITENS_CHECKLIST,
  ITENS_POR_TURMA,
  MARCA_CDE,
  MARCA_VERIFICADO,
  SECOES_GERAL,
  SECOES_TURMA,
  VERIFICACAO_FEITA,
  VERIFICACAO_PENDENTE,
  auditoriaDeReferencia,
  avaliacaoTurmaPadrao,
  comGeral,
  consolidar,
  consolidarSituacoes,
  divergeDaDeclaracao,
  itemDasTurmas,
  itemPorRotulo,
  lerSituacao,
  pendentesDaTurma,
  pendentesGerais,
  planejarAplicacao,
  registrosDaAplicacao,
  respostasComDados,
  type RespostaItem,
} from './checklist';
import type { Avaliacao, AvaliacaoTurma, SituacaoItem } from './types';

const r = (situacao: SituacaoItem, observacao = ''): RespostaItem => ({ situacao, atualizado: '', prazo: '', responsavel: '', observacao });
const META = { ano: 2026, arquivo: 'checklist.xlsx', data: '2026-10-16' };
const av = (item: string, extra: Partial<Avaliacao> = {}): Avaliacao => ({ ...avaliacaoPadrao('AUD-001', item), ...extra });
const at = (item: string, turma: string, extra: Partial<AvaliacaoTurma> = {}): AvaliacaoTurma => ({ ...avaliacaoTurmaPadrao('AUD-001', item, turma), ...extra });
const porItem = (lista: AvaliacaoTurma[]) => {
  const m = new Map<string, Map<string, AvaliacaoTurma>>();
  for (const a of lista) m.set(a.item, (m.get(a.item) ?? new Map()).set(a.turma, a));
  return m;
};

describe('modelo da checklist', () => {
  it('separa os 24 documentos da unidade dos 10 conferidos em cada turma', () => {
    expect(ITENS_CHECKLIST).toHaveLength(34);
    expect(SECOES_GERAL.map((s) => [s.titulo, s.itens.length])).toEqual([
      ['Checagem de Documentos Institucionais', 7],
      ['Checagem de Documentos de Secretaria Escolar', 7],
      ['Checagem de Documentos dos Servidores', 5],
      ['Checagem de Documentos dos Administrativos', 5],
    ]);
    expect(SECOES_TURMA.map((s) => [s.titulo, s.itens.map((i) => i.codigo)])).toEqual([
      ['Checagem de Documentos de Secretaria Escolar', ['SEC-06']],
      ['Checagem de Documentos dos Alunos', ['EST-01', 'EST-02', 'EST-03', 'EST-04', 'EST-05', 'EST-06', 'EST-07', 'EST-08', 'EST-09']],
    ]);
    expect(SECOES_GERAL[0].itens[0]).toMatchObject({ codigo: 'INS-01', rotulo: 'Ato de criação da escola', porTurma: false });
  });

  it('acha o item pelo texto, com o da Lista Mestra e desempatando pela seção', () => {
    expect(itemPorRotulo('LIVRO DE MATRÍCULA')).toBe('SEC-01');
    expect(itemPorRotulo('Pasta individual')).toBe('EST-03');
    expect(itemPorRotulo('Relação nominal dos estudantes', 'Checagem de Documentos de Secretaria Escolar')).toBe('SEC-06');
    expect(itemPorRotulo('Relação nominal dos estudantes', 'Checagem de Documentos dos Administrativos')).toBe('ADM-02');
    expect(itemPorRotulo('Correspondências oficiais', 'Checagem de Documentos dos Administrativos')).toBe('ADM-04');
    expect(itemPorRotulo('Outra coisa')).toBeNull();
  });

  it('entende a situação escrita de vários jeitos', () => {
    expect(lerSituacao('CONFORME')).toBe('Conforme');
    expect(lerSituacao('nao conforme')).toBe('Não conforme');
    expect(lerSituacao('N/A')).toBe('Não se aplica');
    expect(lerSituacao('')).toBe('Não avaliado');
    expect(lerSituacao('talvez')).toBeNull();
  });

  it('conta as pendências como a fórmula do título (Não conforme + Não avaliado)', () => {
    expect(pendentesDaTurma({})).toBe(10);
    expect(pendentesDaTurma({ 'EST-01': r('Conforme'), 'EST-02': r('Não se aplica'), 'EST-03': r('Não conforme') })).toBe(8);
    expect(pendentesGerais({ 'INS-01': r('Conforme') })).toBe(23);
    expect(pendentesGerais({}, false)).toBe(34);
  });
});

describe('situação a partir das turmas', () => {
  it('não conformidade aparece logo; conformidade só com todas as turmas conferidas', () => {
    expect(consolidarSituacoes(['Conforme', 'Conforme'])).toBe('Conforme');
    expect(consolidarSituacoes(['Conforme', 'Não avaliado'])).toBe('Não avaliado');
    expect(consolidarSituacoes(['Conforme', 'Não conforme', 'Não avaliado'])).toBe('Parcialmente conforme');
    expect(consolidarSituacoes(['Não conforme', 'Não avaliado'])).toBe('Não conforme');
    expect(consolidarSituacoes(['Parcialmente conforme', 'Parcialmente conforme'])).toBe('Parcialmente conforme');
    expect(consolidarSituacoes(['Não se aplica', 'Conforme'])).toBe('Conforme');
    expect(consolidarSituacoes(['Não se aplica', 'Não se aplica'])).toBe('Não se aplica');
    expect(consolidarSituacoes([])).toBe('Não avaliado');
  });

  it('o item da auditoria resulta das turmas, e a verificação fica pendente enquanto houver turma autodeclarada', () => {
    const base = av('EST-01', { achado: 'conferir pastas' });
    const regs = [at('EST-01', 'T1', { situacao: 'Conforme' }), at('EST-01', 'T2', { situacao: 'Não conforme', verificacao: VERIFICACAO_PENDENTE, declarado: 'Não conforme' })];
    const item = itemDasTurmas(base, regs, ['T1', 'T2', 'T3']);
    expect(item).toMatchObject({ situacao: 'Parcialmente conforme', verificacao: VERIFICACAO_PENDENTE, achado: 'conferir pastas' });
    expect(item.declaracao).toContain('Não conforme: T2');
    const verificado = itemDasTurmas(base, [regs[0], { ...regs[1], verificacao: VERIFICACAO_FEITA }, at('EST-01', 'T3', { situacao: 'Conforme' })], ['T1', 'T2', 'T3']);
    expect(verificado).toMatchObject({ situacao: 'Parcialmente conforme', verificacao: VERIFICACAO_FEITA });
    expect(itemDasTurmas(base, [], ['T1'])).toBe(base);
  });
});

describe('consolidação da planilha', () => {
  const c = {
    geral: { 'INS-01': r('Conforme', 'pasta 1'), 'INS-02': r('Não conforme') },
    turmas: {
      T1: { 'EST-01': r('Conforme'), 'EST-02': r('Não conforme', 'sem histórico') },
      T2: { 'EST-01': r('Conforme'), 'EST-02': r('Conforme') },
    },
  };

  it('itens da unidade vêm da aba geral; itens por turma juntam as turmas', () => {
    const m = consolidar(c, ['T1', 'T2']);
    expect(m.get('INS-01')).toMatchObject({ situacao: 'Conforme', porTurma: false, observacoes: ['pasta 1'] });
    expect(m.get('INS-02')?.situacao).toBe('Não conforme');
    expect(m.get('EST-01')).toMatchObject({ situacao: 'Conforme', porTurma: true, turmas: 2 });
    expect(m.get('EST-02')).toMatchObject({ situacao: 'Parcialmente conforme', naoConformes: ['T1'], observacoes: ['T1: sem histórico'] });
    // Turma do panorama sem aba conta como não avaliada.
    expect(consolidar(c, ['T1', 'T2', 'T3']).get('EST-01')).toMatchObject({ situacao: 'Não avaliado', semResposta: ['T3'] });
  });

  it('sem turmas, todos os itens são da aba geral', () => {
    const m = consolidar({ geral: { 'EST-01': r('Conforme') }, turmas: {} });
    expect(m.get('EST-01')).toMatchObject({ situacao: 'Conforme', porTurma: false });
  });

  it('checklist salva no formato antigo (todos os itens em cada turma) ganha a aba geral', () => {
    const antiga = comGeral({ turmas: { T1: { 'INS-01': r('Conforme', 'ok'), 'EST-01': r('Conforme') }, T2: { 'INS-01': r('Conforme') } } });
    expect(antiga.geral['INS-01']).toMatchObject({ situacao: 'Conforme', observacao: 'T1: ok' });
    expect(antiga.turmas).toEqual({ T1: { 'EST-01': r('Conforme') }, T2: {} });
  });
});

describe('aplicação na Auditoria Documental', () => {
  const c = {
    geral: { 'INS-01': r('Conforme'), 'INS-02': r('Não conforme'), 'INS-03': r('Conforme'), 'INS-04': r('Conforme') },
    turmas: {
      T1: { 'EST-01': r('Conforme'), 'EST-02': r('Conforme'), 'EST-03': r('Não conforme', 'falta') },
      T2: { 'EST-01': r('Não conforme'), 'EST-02': r('Conforme') },
    },
  };
  const atuais = new Map([
    // CDE avaliou: não muda, mas a declaração diferente fica registrada.
    ['INS-02', av('INS-02', { situacao: 'Conforme', achado: 'conferido' })],
    // Autodeclaração anterior ainda pendente: é atualizada.
    ['INS-03', av('INS-03', { situacao: 'Não conforme', declarado: 'Não conforme', verificacao: VERIFICACAO_PENDENTE })],
    // Já verificada pela CDE: a CDE prevalece.
    ['INS-04', av('INS-04', { situacao: 'Não conforme', declarado: 'Não conforme', verificacao: VERIFICACAO_FEITA })],
  ]);
  const atuaisTurma = porItem([
    at('EST-01', 'T2', { situacao: 'Conforme' }), // CDE avaliou a turma T2: mantém e aponta a divergência
    at('EST-02', 'T1', { situacao: 'Conforme', declarado: 'Conforme', verificacao: VERIFICACAO_PENDENTE }), // igual: nada muda
  ]);
  const plano = planejarAplicacao(c, 'AUD-001', atuais, atuaisTurma, ['T1', 'T2'], META);
  const item = (codigo: string) => plano.itens.find((m) => m.codigo === codigo)!;
  const turma = (codigo: string, t: string) => plano.turmas.find((m) => m.codigo === codigo && m.turma === t)!;

  it('itens da unidade: o não avaliado recebe a declaração, marcado para a CDE verificar', () => {
    expect(plano.itens.map((m) => m.codigo)).toEqual(ITENS_CHECKLIST.filter((i) => !ITENS_POR_TURMA.includes(i.codigo)).map((i) => i.codigo));
    expect(item('INS-01').acao).toBe('aplicar');
    expect(item('INS-01').depois).toMatchObject({ situacao: 'Conforme', declarado: 'Conforme', verificacao: VERIFICACAO_PENDENTE });
    expect(item('INS-03')).toMatchObject({ acao: 'aplicar' });
    expect(item('INS-03').depois.situacao).toBe('Conforme');
  });

  it('nunca substitui o que a CDE avaliou ou verificou', () => {
    expect(item('INS-02')).toMatchObject({ acao: 'manter', diverge: true });
    expect(item('INS-02').depois).toMatchObject({ situacao: 'Conforme', achado: 'conferido', declarado: 'Não conforme' });
    expect(item('INS-02').depois.verificacao).toBeUndefined();
    expect(divergeDaDeclaracao(item('INS-02').depois)).toBe(true);
    expect(item('INS-04').depois).toMatchObject({ situacao: 'Não conforme', verificacao: VERIFICACAO_FEITA, declarado: 'Conforme' });
  });

  it('itens por turma: cada turma recebe a sua declaração, com as mesmas regras', () => {
    expect(turma('EST-01', 'T1')).toMatchObject({ acao: 'aplicar', depois: { situacao: 'Conforme', verificacao: VERIFICACAO_PENDENTE, declarado: 'Conforme' } });
    expect(turma('EST-01', 'T2')).toMatchObject({ acao: 'manter', diverge: true, depois: { situacao: 'Conforme', declarado: 'Não conforme', verificacao: '' } });
    expect(turma('EST-02', 'T1').acao).toBe('igual');
    expect(turma('EST-03', 'T1').depois).toMatchObject({ situacao: 'Não conforme', observacao: 'falta' });
    expect(turma('EST-03', 'T2').acao).toBe('sem-declaracao');
  });

  it('reaplicar a mesma planilha não muda nada', () => {
    const gravar = registrosDaAplicacao(plano);
    expect(gravar.itens.map((a) => a.item)).toEqual(['INS-01', 'INS-02', 'INS-03', 'INS-04']);
    expect(gravar.turmas.map((a) => `${a.item}/${a.turma}`)).toEqual(['EST-01/T1', 'EST-01/T2', 'EST-02/T2', 'EST-03/T1']);
    const depois = new Map(atuais);
    for (const a of gravar.itens) depois.set(a.item, a);
    const depoisTurma = porItem([...[...atuaisTurma.values()].flatMap((m) => [...m.values()]), ...gravar.turmas]);
    const denovo = planejarAplicacao(c, 'AUD-001', depois, depoisTurma, ['T1', 'T2'], META);
    expect(registrosDaAplicacao(denovo)).toEqual({ itens: [], turmas: [] });
  });

  it('sem turmas no panorama, os itens por turma são aplicados na unidade', () => {
    const p = planejarAplicacao({ geral: { 'EST-01': r('Conforme') }, turmas: {} }, 'AUD-001', undefined, undefined, [], META);
    expect(p.turmas).toEqual([]);
    expect(p.itens.find((m) => m.codigo === 'EST-01')?.acao).toBe('aplicar');
  });
});

describe('planilha com dados', () => {
  const salvas = {
    geral: { 'INS-01': r('Não conforme', 'falta'), 'INS-03': r('Conforme') },
    turmas: { T1: { 'EST-01': r('Não conforme', 'sem ficha'), 'EST-02': r('Conforme') }, T2: { 'EST-01': r('Conforme') } },
  };
  const avaliacoes = new Map([
    ['INS-01', av('INS-01', { situacao: 'Conforme' })], // CDE avaliou: vale a CDE
    ['INS-02', av('INS-02', { situacao: 'Não conforme', verificacao: VERIFICACAO_FEITA })], // verificado
    ['INS-03', av('INS-03', { situacao: 'Conforme', declarado: 'Conforme', verificacao: VERIFICACAO_PENDENTE })], // autodeclarado: fica a secretaria
    ['EST-03', av('EST-03', { situacao: 'Conforme' })], // avaliado só para a unidade, sem turmas: vale em todas as turmas
  ]);
  const turmas = porItem([at('EST-01', 'T1', { situacao: 'Conforme' })]);
  const saida = respostasComDados(['T1', 'T2', 'T3'], salvas, avaliacoes, turmas);

  it('itens da unidade: o que a CDE avaliou, com a marca (a observação da secretaria fica)', () => {
    expect(saida.geral['INS-01']).toMatchObject({ situacao: 'Conforme', observacao: 'falta' });
    expect(saida.geral['INS-02']).toMatchObject({ situacao: 'Não conforme', observacao: MARCA_VERIFICADO });
    expect(saida.geral['INS-03']).toMatchObject({ situacao: 'Conforme', observacao: '' });
  });

  it('itens por turma: a avaliação da CDE em cada turma; onde ela não avaliou, a resposta da secretaria', () => {
    expect(saida.turmas.T1['EST-01']).toMatchObject({ situacao: 'Conforme', observacao: 'sem ficha' });
    expect(saida.turmas.T2['EST-01']).toMatchObject({ situacao: 'Conforme', observacao: '' });
    expect(saida.turmas.T3['EST-01']).toBeUndefined();
    expect(saida.turmas.T1['EST-02'].situacao).toBe('Conforme');
    expect(saida.turmas.T3['EST-03']).toMatchObject({ situacao: 'Conforme', observacao: MARCA_CDE });
  });

  it('reaplicar a planilha com dados não cria divergência com a CDE', () => {
    const plano = planejarAplicacao(saida, 'AUD-001', avaliacoes, turmas, ['T1', 'T2', 'T3'], META);
    expect([...plano.itens, ...plano.turmas].filter((m) => m.diverge)).toEqual([]);
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
