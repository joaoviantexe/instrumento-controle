import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLANILHA } from '../data/planilha';
import { ATOS_DIARIO, atosDaUnidade, linkDiario, referenciaDiario, tituloAto } from './diario';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const unidades = new Map(PLANILHA.unidades.map((u) => [u.id, u]));

describe('atos do Diário Oficial (dados)', () => {
  it('cada ato tem identificação, data válida e publicação no Diário ou a origem explicada', () => {
    const ids = new Set<string>();
    for (const a of ATOS_DIARIO) {
      expect(ids.has(a.id), `id repetido: ${a.id}`).toBe(false);
      ids.add(a.id);
      expect(['Decreto', 'Portaria', 'Resolução', 'Lei']).toContain(a.tipo);
      expect(a.numero && a.ementa).toBeTruthy();
      if (a.data) expect(a.data).toMatch(ISO);
      if (!a.publicacao) {
        expect(a.referencia, `${a.id} sem publicação nem referência`).toBeTruthy();
        continue;
      }
      const p = a.publicacao;
      expect(p.data).toMatch(ISO);
      expect(p.pagina).toBeGreaterThan(0);
      if (p.pagina_final) expect(p.pagina_final).toBeGreaterThan(p.pagina);
      if (p.edicao !== null) expect(p.edicao).toBeGreaterThan(9000);
      // A publicação vem no mesmo dia ou depois do ato.
      if (a.data) expect(p.data >= a.data, `${a.id}: publicado antes da data do ato`).toBe(true);
    }
  });

  it('as edições crescem com a data (o número da edição confere com a data da publicação)', () => {
    const edicoes = [...new Map(ATOS_DIARIO.filter((a) => a.publicacao?.edicao).map((a) => [a.publicacao!.edicao!, a.publicacao!.data])).entries()].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < edicoes.length; i++) expect(edicoes[i][1] >= edicoes[i - 1][1], `edição ${edicoes[i][0]}`).toBe(true);
  });

  it('cada associação aponta para uma unidade do cadastro, com o INEP correspondente', () => {
    for (const a of ATOS_DIARIO) {
      expect(a.unidades.length, a.id).toBeGreaterThan(0);
      for (const v of a.unidades) {
        const u = unidades.get(v.id);
        expect(u, `${a.id}: unidade ${v.id} não existe`).toBeDefined();
        expect(v.inep, `${a.id}: INEP de ${v.id}`).toBe(u!.inep);
        expect(['alta', 'media', 'baixa']).toContain(v.confianca);
        if (v.confianca !== 'alta') expect(v.nota, `${a.id}/${v.id}: associação incerta sem explicação`).toBeTruthy();
      }
    }
  });

  it('os PDFs de origem citados existem em dados/atos-de-criacao', () => {
    for (const a of ATOS_DIARIO) for (const f of a.arquivos) expect(existsSync(`dados/atos-de-criacao/${f}`), f).toBe(true);
  });
});

describe('varredura do Diário (dados)', () => {
  it('a Portaria 1.221/2009 (Rita Nery Vanetta) tem a edição achada pela varredura', () => {
    const a = ATOS_DIARIO.find((x) => x.id === 'portaria-1221-2009')!;
    expect(a.publicacao).toMatchObject({ edicao: 11523, data: '2009-12-15', pagina: 9 });
    expect(linkDiario(a.publicacao, 'https://w.exemplo')).toBe('https://w.exemplo/diario/11523.pdf?pagina=9#page=9');
    expect(a.nota ?? '').not.toMatch(/número da edição/);
  });

  it('todo ato que veio da varredura (sem PDF de origem) tem edição, página e data de publicação', () => {
    const daVarredura = ATOS_DIARIO.filter((a) => a.arquivos.length === 0 && a.publicacao);
    expect(daVarredura.length).toBeGreaterThan(30);
    for (const a of daVarredura) {
      expect(a.publicacao!.edicao, a.id).toBeGreaterThan(10000);
      expect(a.publicacao!.pagina, a.id).toBeGreaterThan(0);
    }
  });

  it('o ato de criação que o cadastro cita para cada unidade está associado a ela', () => {
    const chave = (tipo: string, numero: string) => `${tipo.slice(0, 4).toUpperCase()}|${numero.split('/')[0].replace(/[.\s]/g, '').replace(/^0+/, '')}`;
    const porChave = new Map<string, Set<string>>();
    for (const a of ATOS_DIARIO) for (const v of a.unidades) porChave.set(chave(a.tipo, a.numero), (porChave.get(chave(a.tipo, a.numero)) ?? new Set()).add(v.id));
    let conferidas = 0;
    for (const u of PLANILHA.unidades) {
      const m = /^\s*(DECRETO|PORTARIA)\s+N\S*\s*([0-9][0-9.]*)/i.exec(u.ato_criacao || '');
      if (!m) continue;
      const k = chave(m[1], m[2]);
      if (!porChave.has(k)) continue; // ato que a varredura não viu (edições antigas só em imagem)
      conferidas++;
      expect(porChave.get(k)!.has(u.id), `${u.id}: ${u.ato_criacao}`).toBe(true);
    }
    expect(conferidas).toBeGreaterThan(90);
  });
});

describe('links e textos', () => {
  const pub = { edicao: 15011, data: '2024-08-16', pagina: 2, pagina_final: 3 };

  it('monta o link que abre a edição na página do ato', () => {
    expect(linkDiario(pub, 'https://w.exemplo')).toBe('https://w.exemplo/diario/15011.pdf?pagina=2#page=2');
  });

  it('não monta link sem Worker ou sem número de edição', () => {
    expect(linkDiario(pub, '')).toBeNull();
    expect(linkDiario({ ...pub, edicao: null }, 'https://w.exemplo')).toBeNull();
    expect(linkDiario(null, 'https://w.exemplo')).toBeNull();
  });

  it('descreve a publicação e o ato', () => {
    expect(referenciaDiario(pub)).toBe('DOM nº 15.011, de 16/08/2024, p. 2–3');
    expect(referenciaDiario({ edicao: null, data: '2009-12-15', pagina: 9 })).toBe('DOM (edição a identificar), de 15/12/2009, p. 9');
    const a = ATOS_DIARIO.find((x) => x.id === 'decreto-111991-2024')!;
    expect(tituloAto(a)).toBe('Decreto nº 111.991/2024-PMB, de 13/08/2024');
  });

  it('lista os atos de uma unidade em ordem cronológica', () => {
    const lista = atosDaUnidade('UN-174').map((x) => x.ato.numero);
    expect(lista).toEqual(['95.305/2020-PMB', '582/2024-GABS/SEMEC', '1.077/2024-GABS/SEMEC', '111.392/2024-PMB']);
    expect(atosDaUnidade('UN-999')).toEqual([]);
  });
});

it('referência: atos são mostrados com título legível', () => {
  expect(ATOS_DIARIO.every((a) => tituloAto(a).startsWith(a.tipo))).toBe(true);
});
