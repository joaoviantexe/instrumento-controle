import { describe, expect, it } from 'vitest';
import referencia from './__fixtures__/referencia-planilha.json';
import { AUDITORIAS_INICIAIS, LISTA_MESTRA, SECOES, TEXTOS, UNIDADES_INICIAIS } from '../data/planilha';
import {
  avaliacaoPadrao,
  contarSituacoes,
  diasRestantes,
  distribuicaoDistritos,
  indexarAvaliacoes,
  indiceGlobal,
  matrizBairroDistrito,
  linhasDaAuditoria,
  linhasRegistradas,
  matrizSecoes,
  pesoAplicavel,
  pontos,
  proximoId,
  qualidadeCadastro,
  resumirAuditoria,
  vigenciaVencida,
} from './calc';
import type { Auditoria, Avaliacao, SituacaoItem } from './types';
import { formatarData, lerData } from './format';

const PRIMEIRA = AUDITORIAS_INICIAIS[0];

/** Mesmo cenário aplicado à planilha e recalculado no LibreOffice. */
function cenario(): Avaliacao[] {
  return LISTA_MESTRA.map((item, i) => ({
    ...avaliacaoPadrao(PRIMEIRA.id, item.codigo),
    situacao: referencia.padrao[(i * 3 + 1) % referencia.padrao.length] as SituacaoItem,
  }));
}

describe('dados extraídos da planilha', () => {
  it('mantém as contagens da planilha', () => {
    expect(UNIDADES_INICIAIS).toHaveLength(217);
    expect(LISTA_MESTRA).toHaveLength(53);
    expect(LISTA_MESTRA.filter((i) => i.peso > 0)).toHaveLength(41);
    expect(AUDITORIAS_INICIAIS).toHaveLength(217);
    expect(SECOES).toHaveLength(7);
    expect(AUDITORIAS_INICIAIS.filter((a) => a.iniciada).map((a) => a.id)).toEqual(['AUD-001']);
  });

  it('vincula todas as auditorias a uma unidade', () => {
    const ids = new Set(UNIDADES_INICIAIS.map((u) => u.id));
    expect(AUDITORIAS_INICIAIS.every((a) => ids.has(a.unidade_id))).toBe(true);
  });
});

describe('Auditoria Documental (colunas M, N e O)', () => {
  it('aplica a pontuação dos Critérios de Classificação', () => {
    expect(pesoAplicavel('Conforme', 3)).toBe(3);
    expect(pesoAplicavel('Não se aplica', 3)).toBe(0);
    expect(pesoAplicavel('', 3)).toBe(0);
    expect(pesoAplicavel('Conforme', 0)).toBe(0);
    expect(pontos('Conforme', 3)).toBe(3);
    expect(pontos('Parcialmente conforme', 3)).toBe(1.5);
    expect(pontos('Não conforme', 3)).toBe(0);
    expect(pontos('Não avaliado', 3)).toBe(0);
  });

  it('coincide item a item com a planilha recalculada', () => {
    const linhas = linhasDaAuditoria(PRIMEIRA.id, indexarAvaliacoes(cenario()));
    linhas.forEach((l, i) => {
      const ref = referencia.itens[i];
      expect(l.situacao).toBe(ref.situacao);
      expect(l.pesoAplicavel).toBe(ref.pesoAplicavel);
      expect(l.pontos).toBe(ref.pontos);
      if (ref.indice === null) expect(l.indice).toBeNull();
      else expect(l.indice).toBeCloseTo(ref.indice, 10);
    });
  });
});

describe('Dashboard e Relatórios', () => {
  const auditorias: Auditoria[] = AUDITORIAS_INICIAIS;
  const linhas = linhasRegistradas(auditorias, indexarAvaliacoes(cenario()));

  it('reproduz os indicadores do Dashboard', () => {
    const contagem = contarSituacoes(linhas);
    const [unidades, itens, auds, avaliados, naoConformes, indice] = referencia.kpis;
    expect(UNIDADES_INICIAIS.length).toBe(unidades);
    expect(LISTA_MESTRA.length).toBe(itens);
    expect(auditorias.length).toBe(auds);
    expect(linhas.length - contagem['Não avaliado']).toBe(avaliados);
    expect(contagem['Não conforme']).toBe(naoConformes);
    expect(indiceGlobal(linhas)).toBeCloseTo(indice as number, 10);
    expect(contagem).toEqual(referencia.pizza);
  });

  it('reproduz a matriz por seção', () => {
    const matriz = matrizSecoes(linhas);
    matriz.forEach((m, i) => {
      const [secao, c, p, nc, na, nav, total, indice] = referencia.matriz[i];
      expect(m.secao).toBe(secao);
      expect([
        m.contagem['Conforme'],
        m.contagem['Parcialmente conforme'],
        m.contagem['Não conforme'],
        m.contagem['Não se aplica'],
        m.contagem['Não avaliado'],
        m.total,
      ]).toEqual([c, p, nc, na, nav, total]);
      if (indice === null) expect(m.indice).toBeNull();
      else expect(m.indice).toBeCloseTo(indice as number, 10);
    });
  });

  it('reproduz a abrangência por seção', () => {
    expect(SECOES.map((s) => LISTA_MESTRA.filter((i) => i.secao === s).length)).toEqual(referencia.secoes);
  });

  it('reproduz a distribuição por distrito', () => {
    const dist = distribuicaoDistritos(UNIDADES_INICIAIS);
    referencia.distribuicao.forEach(([distrito, mun, osc, total, part], i) => {
      expect(dist[i].distrito).toBe(distrito);
      expect([dist[i].municipal, dist[i].osc, dist[i].total]).toEqual([mun, osc, total]);
      expect(dist[i].participacao).toBeCloseTo(part as number, 10);
    });
  });

  it('reproduz a tabela dinâmica DistritoBairro', () => {
    const m = matrizBairroDistrito(UNIDADES_INICIAIS);
    expect(m.linhas).toHaveLength(54);
    expect(m.total).toBe(217);
    // totais por coluna = total por distrito da aba Relatórios
    referencia.distribuicao.forEach(([distrito, , , total], i) => {
      expect(m.distritos[i]).toBe(distrito);
      expect(m.totais[i]).toBe(total);
    });
    expect(m.linhas.every((l) => l.total === l.contagem.reduce((a, b) => a + b, 0))).toBe(true);
    const guama = m.linhas.find((l) => l.bairro === 'GUAMA')!;
    expect(guama.total).toBe(13);
  });

  it('reproduz a qualidade do cadastro territorial', () => {
    const q = qualidadeCadastro(UNIDADES_INICIAIS, TEXTOS.dashboard.qualidade);
    referencia.qualidade.forEach(([indicador, registros, cobertura], i) => {
      expect(q[i].indicador).toBe(indicador);
      expect(q[i].registros).toBe(registros);
      expect(q[i].cobertura).toBeCloseTo(cobertura as number, 10);
    });
  });
});

describe('Plano de Auditoria (colunas J a N)', () => {
  it('resume o bloco da auditoria', () => {
    const r = resumirAuditoria(PRIMEIRA, indexarAvaliacoes(cenario()));
    expect(r.previstos).toBe(53);
    expect(r.avaliados).toBe(45);
    expect(r.indice).toBeCloseTo(referencia.kpis[5] as number, 10);
    // Não conformes com peso 3 entre os itens técnicos do cenário
    const criticas = LISTA_MESTRA.filter(
      (item, i) => item.peso === 3 && referencia.padrao[(i * 3 + 1) % 7] === 'Não conforme',
    ).length;
    expect(r.ncCriticas).toBe(criticas);
    // 10 dos 12 itens da visita foram avaliados no cenário
    expect(r.checklist).toBeCloseTo(10 / 12, 10);
  });

  it('não contabiliza auditorias sem bloco iniciado', () => {
    const r = resumirAuditoria(AUDITORIAS_INICIAIS[1], new Map());
    expect(r).toMatchObject({ previstos: 0, avaliados: 0, indice: null, checklist: null });
  });

  it('bloco iniciado sem avaliações tem índice 0%, como na planilha', () => {
    const r = resumirAuditoria(PRIMEIRA, new Map());
    expect(r).toMatchObject({ previstos: 53, avaliados: 0, indice: 0, ncCriticas: 0, checklist: 0 });
  });
});

describe('utilitários', () => {
  it('calcula os dias restantes do Plano de Ação', () => {
    expect(diasRestantes('2026-10-10', '2026-10-06')).toBe(4);
    expect(diasRestantes('2026-10-01', '2026-10-06')).toBe(-5);
    expect(diasRestantes('', '2026-10-06')).toBeNull();
  });

  it('identifica vigência vencida apenas para datas', () => {
    expect(vigenciaVencida('2022-12-11', '2026-10-06')).toBe(true);
    expect(vigenciaVencida('2030-06-16', '2026-10-06')).toBe(false);
    expect(vigenciaVencida('DEFINITIVO', '2026-10-06')).toBe(false);
  });

  it('gera o próximo identificador', () => {
    expect(proximoId('AUD', ['AUD-001', 'AUD-217'])).toBe('AUD-218');
    expect(proximoId('AC', [])).toBe('AC-001');
  });

  it('converte datas', () => {
    expect(formatarData('2026-08-31')).toBe('31/08/2026');
    expect(lerData('31/08/2026')).toBe('2026-08-31');
    expect(lerData('DEFINITIVO')).toBe('DEFINITIVO');
  });
});
