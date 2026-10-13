import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLANILHA } from '../data/planilha';
import { criarConferenciasLocal } from './backend/local';
import { RESOLUCOES_CME, resolucoesDaUnidade } from './cme';
import { atosDiarioSemLink, chaveDe, indexarConferencias, itensCme, itensDiario, situacaoDoVinculo, unidadesSemResolucao, type Conferencia } from './conferencias';
import { ATOS_DIARIO, atosDaUnidade } from './diario';

const conf = (c: Pick<Conferencia, 'fonte' | 'ato_id' | 'unidade_id' | 'decisao'>): Conferencia => ({ nota: '', conferido_por: 'a@b', conferido_em: '2026-10-13T12:00:00Z', ...c });

describe('conferência de atos', () => {
  it('a decisão manda na situação da associação: confirmado, recusado ou a do arquivo de dados', () => {
    const mapa = indexarConferencias([conf({ fonte: 'cme', ato_id: 'r1', unidade_id: 'UN-1', decisao: 'confirmado' }), conf({ fonte: 'cme', ato_id: 'r2', unidade_id: 'UN-1', decisao: 'recusado' })]);
    expect(situacaoDoVinculo(mapa, 'cme', 'r1', 'UN-1', 'media')).toBe('confirmado');
    expect(situacaoDoVinculo(mapa, 'cme', 'r2', 'UN-1', 'alta')).toBe('recusado');
    expect(situacaoDoVinculo(mapa, 'cme', 'r3', 'UN-1', 'baixa')).toBe('baixa');
    expect(situacaoDoVinculo(mapa, 'diario', 'r1', 'UN-1', 'media')).toBe('media'); // a chave inclui a fonte
    expect(situacaoDoVinculo(undefined, 'cme', 'r1', 'UN-1', 'media')).toBe('media');
  });

  it('lista para conferir só o que não é "alta", mais o que já tem decisão (para poder desfazer)', () => {
    const sem = itensCme();
    expect(sem.length).toBeGreaterThan(0);
    expect(sem.every((i) => i.confianca !== 'alta')).toBe(true);
    const alta = RESOLUCOES_CME.flatMap((r) => r.unidades.filter((v) => v.confianca === 'alta').map((v) => ({ r, v })))[0];
    const mapa = indexarConferencias([conf({ fonte: 'cme', ato_id: alta.r.id, unidade_id: alta.v.id, decisao: 'recusado' })]);
    const com = itensCme(RESOLUCOES_CME, mapa);
    expect(com).toHaveLength(sem.length + 1);
    expect(com.find((i) => i.ato_id === alta.r.id)?.conferencia?.decisao).toBe('recusado');
    expect(itensDiario().every((i) => i.confianca !== 'alta')).toBe(true);
  });

  it('na página da unidade, recusar tira a associação e confirmar troca o rótulo (CME e Diário)', () => {
    const r = RESOLUCOES_CME.find((x) => x.unidades.some((v) => v.confianca === 'media'))!;
    const v = r.unidades.find((x) => x.confianca === 'media')!;
    expect(resolucoesDaUnidade(v.id).find((x) => x.resolucao.id === r.id)?.situacao).toBe('media');
    const confirma = indexarConferencias([conf({ fonte: 'cme', ato_id: r.id, unidade_id: v.id, decisao: 'confirmado' })]);
    expect(resolucoesDaUnidade(v.id, RESOLUCOES_CME, confirma).find((x) => x.resolucao.id === r.id)?.situacao).toBe('confirmado');
    const recusa = indexarConferencias([conf({ fonte: 'cme', ato_id: r.id, unidade_id: v.id, decisao: 'recusado' })]);
    expect(resolucoesDaUnidade(v.id, RESOLUCOES_CME, recusa).some((x) => x.resolucao.id === r.id)).toBe(false);

    const a = ATOS_DIARIO.find((x) => x.unidades.some((u) => u.confianca !== 'alta'))!;
    const u = a.unidades.find((x) => x.confianca !== 'alta')!;
    const recusaDiario = indexarConferencias([conf({ fonte: 'diario', ato_id: a.id, unidade_id: u.id, decisao: 'recusado' })]);
    expect(atosDaUnidade(u.id, ATOS_DIARIO, recusaDiario).some((x) => x.ato.id === a.id)).toBe(false);
    expect(atosDaUnidade(u.id).some((x) => x.ato.id === a.id)).toBe(true);
    // uma decisão do CME não mexe no Diário
    const deOutraFonte = indexarConferencias([conf({ fonte: 'cme', ato_id: a.id, unidade_id: u.id, decisao: 'recusado' })]);
    expect(atosDaUnidade(u.id, ATOS_DIARIO, deOutraFonte).some((x) => x.ato.id === a.id)).toBe(true);
  });

  it('unidades sem resolução: as recusadas na conferência passam a contar como sem', () => {
    const base = unidadesSemResolucao(PLANILHA.unidades);
    expect(base.length).toBeGreaterThan(0);
    expect(base.length).toBeLessThan(PLANILHA.unidades.length);
    const r = RESOLUCOES_CME.find((x) => x.unidades.length === 1)!;
    const mapa = indexarConferencias([conf({ fonte: 'cme', ato_id: r.id, unidade_id: r.unidades[0].id, decisao: 'recusado' })]);
    const depois = unidadesSemResolucao(PLANILHA.unidades, RESOLUCOES_CME, mapa);
    // só passa a "sem" se essa era a única resolução da unidade
    const unicas = RESOLUCOES_CME.filter((x) => x.unidades.some((v) => v.id === r.unidades[0].id)).length === 1;
    expect(depois.length).toBe(base.length + (unicas ? 1 : 0));
  });

  it('atos do Diário sem link: os sem edição e os que vieram do portal de leis', () => {
    const lista = atosDiarioSemLink();
    expect(lista.length).toBe(ATOS_DIARIO.filter((a) => !a.publicacao?.edicao).length);
    for (const { motivo } of lista) expect(motivo).toBeTruthy();
  });
});

describe('conferências no modo local', () => {
  const guardado = new Map<string, string>();
  const falso = { getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => void guardado.set(k, v), removeItem: (k: string) => void guardado.delete(k) };
  afterEach(() => {
    guardado.clear();
    vi.unstubAllGlobals();
  });

  it('salva, troca a decisão da mesma associação e desfaz', async () => {
    vi.stubGlobal('localStorage', falso);
    const api = criarConferenciasLocal();
    const chave = { fonte: 'cme' as const, ato_id: 'res-2018-072', unidade_id: 'UN-003' };
    await api.salvar({ ...chave, decisao: 'confirmado', nota: '' });
    await api.salvar({ ...chave, decisao: 'recusado', nota: 'outra escola' });
    const lista = await api.listar();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ decisao: 'recusado', nota: 'outra escola' });
    expect(chaveDe(lista[0])).toBe('cme|res-2018-072|UN-003');
    await api.excluir(chave);
    expect(await api.listar()).toEqual([]);
  });
});
