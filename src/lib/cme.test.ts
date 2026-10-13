import { describe, expect, it } from 'vitest';
import { PLANILHA } from '../data/planilha';
import { RESOLUCOES_CME, resolucoesDaUnidade, tituloResolucao } from './cme';

const unidades = new Map(PLANILHA.unidades.map((u) => [u.id, u]));

describe('resoluções do CME (dados)', () => {
  it('cada resolução tem identificação única, ano plausível e PDF do site do CME', () => {
    const ids = new Set<string>();
    for (const r of RESOLUCOES_CME) {
      expect(ids.has(r.id), `id repetido: ${r.id}`).toBe(false);
      ids.add(r.id);
      expect(r.ano).toBeGreaterThanOrEqual(1995);
      expect(r.ano).toBeLessThanOrEqual(new Date().getFullYear() + 1);
      expect(r.numero).toMatch(/^\d{2,3}$/);
      expect(r.descricao.length, r.id).toBeGreaterThan(10);
      expect(r.url, r.id).toMatch(/^https:\/\/cme-website\.cdn\.prismic\.io\//);
      expect(r.unidades.length, r.id).toBeGreaterThan(0);
    }
  });

  it('cada associação aponta para uma unidade do cadastro, com o INEP correspondente e sem repetição', () => {
    for (const r of RESOLUCOES_CME) {
      const vistos = new Set<string>();
      for (const v of r.unidades) {
        const u = unidades.get(v.id);
        expect(u, `${r.id} → ${v.id}`).toBeDefined();
        expect(v.inep).toBe(u!.inep);
        expect(vistos.has(v.id), `${r.id} repete ${v.id}`).toBe(false);
        vistos.add(v.id);
        expect(['alta', 'media', 'baixa']).toContain(v.confianca);
        expect(v.relacao).toBeTruthy();
        if (v.confianca !== 'alta') expect(v.nota, `${r.id} → ${v.id} sem nota`).toBeTruthy();
      }
    }
  });

  it('todo ato de autorização do CME citado no cadastro está associado à unidade', () => {
    for (const u of PLANILHA.unidades) {
      for (const m of (u.ato_autorizacao || '').matchAll(/(\d{1,3})\s*\/\s*(\d{4})\s*-?\s*CME/g)) {
        const numero = Number(m[1]);
        const achou = RESOLUCOES_CME.some((r) => r.ano === Number(m[2]) && Number(r.numero) === numero && r.unidades.some((v) => v.id === u.id));
        expect(achou, `${u.id}: ${m[0]} não está associado`).toBe(true);
      }
    }
  });

  it('lista as resoluções da unidade da mais antiga para a mais recente', () => {
    const comVarias = PLANILHA.unidades.find((u) => resolucoesDaUnidade(u.id).length > 1);
    if (!comVarias) return;
    const anos = resolucoesDaUnidade(comVarias.id).map((x) => x.resolucao.ano);
    expect(anos).toEqual([...anos].sort((a, b) => a - b));
  });

  it('formata o título', () => {
    expect(tituloResolucao({ numero: '072', ano: 2018 })).toBe('Resolução nº 072/2018 - CME');
  });
});
