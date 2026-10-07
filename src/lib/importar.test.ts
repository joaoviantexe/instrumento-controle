import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { snapshotInicial } from './backend/inicial';
import { lerPlanilha, planejarImportacao, registrosParaGravar } from './importar';

const ARQUIVO = 'Instrumento_Controle_Documentacao_Escolar_CDE_SEMEC (4).xlsx';

async function original() {
  const buf = readFileSync(ARQUIVO);
  return lerPlanilha(new File([buf], ARQUIVO));
}

describe('importação de planilha', () => {
  it('a planilha original coincide com os dados iniciais (nada a alterar)', async () => {
    const plano = planejarImportacao(await original(), snapshotInicial());
    expect(plano.unidades.lidas).toBe(217);
    expect(plano.unidades.novos).toHaveLength(0);
    expect(plano.unidades.alterados.map((a) => a.antes.nome)).toEqual([]);
    expect(plano.auditorias.novos).toHaveLength(0);
    expect(plano.auditorias.alterados.map((a) => a.antes.id + a.campos.map((c) => c.rotulo))).toEqual([]);
    expect(plano.acoes.encontrada).toBe(true);
  });

  it('detecta unidades novas e alterações em campos', async () => {
    const atual = snapshotInicial();
    const alterada = { ...atual, unidades: atual.unidades.slice(1).map((u, i) => (i === 0 ? { ...u, diretor: 'OUTRA PESSOA' } : u)) };
    const plano = planejarImportacao(await original(), alterada);
    expect(plano.unidades.novos).toHaveLength(1);
    expect(plano.unidades.novos[0].id).toBe('UN-218');
    expect(plano.unidades.alterados).toHaveLength(1);
    expect(plano.unidades.alterados[0].campos[0]).toMatchObject({ para: alterada.unidades[0].diretor === '' ? '' : expect.any(String), de: 'OUTRA PESSOA' });
    const g = registrosParaGravar(plano);
    expect(g.unidades).toHaveLength(2);
  });

  it('o item da Auditoria Documental é ligado ao ID mesmo com zeros a mais (AUD-0001)', async () => {
    const atual = snapshotInicial();
    const plano = planejarImportacao(await original(), { ...atual, auditorias: atual.auditorias.map((a) => ({ ...a, iniciada: false })) });
    expect(plano.avaliacoes.encontrada).toBe(true);
    expect(plano.avisos.filter((a) => a.includes('não existe no Plano'))).toEqual([]);
  });
});
