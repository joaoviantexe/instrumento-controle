/**
 * Teste de integração do backend Supabase contra um PostgREST real.
 * Executado somente quando SUPABASE_TESTE_URL estiver definido, por exemplo:
 *   SUPABASE_TESTE_URL=http://localhost:54321 SUPABASE_TESTE_ANON=<jwt> SUPABASE_TESTE_MEMBRO=<jwt> npx vitest run
 */
import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { criarBackendSupabase } from './supabase';
import { snapshotInicial } from './inicial';
import { ErroChaveDuplicada } from './tipos';
import { avaliacaoPadrao } from '../calc';

const URL_TESTE = process.env.SUPABASE_TESTE_URL;
const ANON = process.env.SUPABASE_TESTE_ANON ?? '';
const MEMBRO = process.env.SUPABASE_TESTE_MEMBRO ?? '';
const INTRUSO = process.env.SUPABASE_TESTE_INTRUSO ?? '';

function cliente(token: string) {
  return createClient(URL_TESTE!, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

describe.skipIf(!URL_TESTE)('backend Supabase (integração)', () => {
  // Criado sob demanda: com o teste pulado, o corpo do describe ainda é executado e URL_TESTE seria indefinida.
  let instancia: ReturnType<typeof criarBackendSupabase> | undefined;
  const backend = new Proxy({} as ReturnType<typeof criarBackendSupabase>, {
    get: (_, prop) => {
      instancia ??= criarBackendSupabase(cliente(MEMBRO));
      return instancia[prop as keyof typeof instancia];
    },
  });

  it('carrega os dados da planilha e lê de volta com paginação', async () => {
    await backend.substituirTudo(snapshotInicial());
    const s = await backend.carregar();
    expect(s.unidades).toHaveLength(217);
    expect(s.auditorias).toHaveLength(217);
    expect(s.auditorias.find((a) => a.id === 'AUD-001')?.iniciada).toBe(true);
    // datas vazias voltam como texto vazio
    expect(s.auditorias[1].data_planejada).toBe('');
    const u = s.unidades.find((x) => x.id === 'UN-002')!;
    expect(u.vigencia_ato).toBe('2030-06-16');
    expect(u.data_atualizacao).toBe('2026-08-31');
  });

  it('grava avaliações (upsert) e ações, com mais de 1000 registros', async () => {
    const avs = snapshotInicial().auditorias.slice(0, 25).flatMap((a) =>
      ['INS-01', 'INS-02', 'INS-03', 'SEC-01', 'SEC-02', 'SEC-03', 'SEC-04', 'SEC-05', 'SEC-06', 'SEC-07', 'SEC-08',
        'EST-01', 'EST-02', 'EST-03', 'EST-04', 'EST-05', 'EST-06', 'EST-07', 'EST-08', 'EST-09', 'SER-01', 'SER-02',
        'SER-03', 'SER-04', 'SER-05', 'ADM-01', 'ADM-02', 'ADM-03', 'ADM-04', 'ADM-05', 'VER-01', 'VER-02', 'VER-03',
        'VER-04', 'VER-05', 'VER-06', 'VER-07', 'VIS-01', 'VIS-02', 'VIS-03', 'VIS-04', 'VIS-05', 'VIS-06'].map((item) => ({
        ...avaliacaoPadrao(a.id, item),
        situacao: 'Conforme' as const,
      })),
    );
    expect(avs.length).toBeGreaterThan(1000);
    await backend.inserir('avaliacoes', avs);
    await backend.salvar('avaliacoes', { ...avs[0], situacao: 'Não conforme', achado: 'teste', prazo: '2026-12-01' });
    await backend.inserir('acoes', [
      {
        id: 'AC-001', auditoria_id: 'AUD-001', unidade_id: 'UN-001', item: 'INS-01', achado: 'a', acao: 'b',
        prioridade: 'Alta', responsavel: '', data_abertura: '2026-10-06', prazo: '', situacao: 'Não iniciada',
        evidencia: '', data_conclusao: '', validacao: 'Pendente',
      },
    ]);
    await expect(
      backend.inserir('acoes', [{ ...(await backend.carregar()).acoes[0] }]),
    ).rejects.toBeInstanceOf(ErroChaveDuplicada);
    const s = await backend.carregar();
    expect(s.avaliacoes).toHaveLength(avs.length);
    const primeira = s.avaliacoes.find((a) => a.auditoria_id === avs[0].auditoria_id && a.item === avs[0].item)!;
    expect(primeira).toMatchObject({ situacao: 'Não conforme', achado: 'teste', prazo: '2026-12-01' });
    expect(s.acoes[0]).toMatchObject({ id: 'AC-001', prazo: '', data_conclusao: '' });
    expect(Object.keys(s.acoes[0])).not.toContain('atualizado_por');
  });

  it('altera várias auditorias de uma vez', async () => {
    const s = await backend.carregar();
    const lote = s.auditorias.slice(1, 4).map((a) => ({ ...a, tipo: 'Auditoria documental', data_planejada: '2026-11-03', equipe: 'Equipe A' }));
    await backend.salvarVarios('auditorias', lote);
    const depois = (await backend.carregar()).auditorias;
    for (const a of lote) {
      expect(depois.find((x) => x.id === a.id)).toMatchObject({ tipo: 'Auditoria documental', data_planejada: '2026-11-03', equipe: 'Equipe A' });
    }
  });

  it('exclui auditoria em cascata', async () => {
    await backend.excluir('auditorias', { id: 'AUD-001' });
    const s = await backend.carregar();
    expect(s.auditorias.some((a) => a.id === 'AUD-001')).toBe(false);
    expect(s.avaliacoes.some((a) => a.auditoria_id === 'AUD-001')).toBe(false);
    expect(s.acoes[0].auditoria_id).toBe('');
  });

  it.skipIf(!INTRUSO)('não mostra dados a quem não é membro', async () => {
    const s = await criarBackendSupabase(cliente(INTRUSO)).carregar();
    expect(s.unidades).toHaveLength(0);
    await expect(criarBackendSupabase(cliente(INTRUSO)).salvar('unidades', snapshotInicial().unidades[0])).rejects.toThrow();
  });
});
