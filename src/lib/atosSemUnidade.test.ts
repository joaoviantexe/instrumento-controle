import { describe, expect, it } from 'vitest';
import { ATOS_SEM_UNIDADE, linkDoAto, referenciaDoAto } from './atosSemUnidade';
import { RESOLUCOES_CME } from './cme';

describe('atos sem unidade (dados)', () => {
  it('cada item tem identificação única, motivo e um jeito de abrir o original', () => {
    const ids = new Set<string>();
    for (const a of ATOS_SEM_UNIDADE) {
      expect(ids.has(a.id), `id repetido: ${a.id}`).toBe(false);
      ids.add(a.id);
      expect(a.titulo && a.descricao && a.motivo, a.id).toBeTruthy();
      if (a.fonte === 'cme') expect(a.url, a.id).toMatch(/^https:\/\/cme-website\.cdn\.prismic\.io\//);
      else expect(a.publicacao?.edicao, a.id).toBeGreaterThan(10000);
      expect(linkDoAto(a, 'https://w.exemplo'), a.id).toBeTruthy();
      expect(referenciaDoAto(a), a.id).toBeTruthy();
    }
    expect(ATOS_SEM_UNIDADE.length).toBeGreaterThan(50);
  });

  it('o que já está ligado a uma unidade não aparece como "sem unidade"', () => {
    const ligadas = new Set(RESOLUCOES_CME.map((r) => `${r.ano}|${Number(r.numero)}`));
    for (const a of ATOS_SEM_UNIDADE.filter((x) => x.fonte === 'cme')) {
      const m = /nº (\d+)\/(\d{4})/.exec(a.titulo)!;
      expect(ligadas.has(`${m[2]}|${Number(m[1])}`), a.titulo).toBe(false);
    }
  });
});
