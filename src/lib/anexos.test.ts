import { describe, expect, it } from 'vitest';
import { LIMITE_BYTES, formatarTamanho, hashArquivo, resumirAnexos, unidadesComAto, validarPdf, CATEGORIA_ATO } from './anexos';
import type { Anexo } from './types';

const pdf = (nome = 'ato.pdf', conteudo = '%PDF-1.7\n...') => new File([conteudo], nome, { type: 'application/pdf' });

describe('validação de anexos PDF', () => {
  it('aceita um PDF válido', async () => {
    expect(await validarPdf(pdf())).toBeNull();
  });
  it('recusa arquivo vazio', async () => {
    expect(await validarPdf(new File([], 'vazio.pdf'))).toContain('vazio');
  });
  it('recusa arquivos que não são PDF pela extensão', async () => {
    expect(await validarPdf(new File(['%PDF-1.4'], 'foto.png', { type: 'image/png' }))).toContain('não é um PDF');
  });
  it('recusa arquivo renomeado para .pdf cujo conteúdo não é PDF', async () => {
    expect(await validarPdf(pdf('falso.pdf', 'MZ\u0090 programa'))).toContain('não é um PDF válido');
  });
  it('recusa arquivos acima do limite', async () => {
    const grande = new File([new Uint8Array(LIMITE_BYTES + 1)], 'grande.pdf', { type: 'application/pdf' });
    expect(await validarPdf(grande)).toContain('limite');
  });
});

describe('utilitários de anexos', () => {
  it('formata o tamanho', () => {
    expect(formatarTamanho(512)).toBe('512 B');
    expect(formatarTamanho(2048)).toBe('2 KB');
    expect(formatarTamanho(1.5 * 1024 * 1024)).toBe('1,5 MB');
  });
  it('identifica unidades com o PDF do ato de autorização', () => {
    const base = { nome: 'a.pdf', tamanho: 1, criado_em: '', criado_por: '' };
    const lista: Anexo[] = [
      { id: '1', entidade: 'unidade', entidade_id: 'UN-001', categoria: CATEGORIA_ATO, ...base },
      { id: '2', entidade: 'unidade', entidade_id: 'UN-002', categoria: 'Outro documento', ...base },
      { id: '3', entidade: 'acao', entidade_id: 'UN-003', categoria: CATEGORIA_ATO, ...base },
    ];
    expect([...unidadesComAto(lista)]).toEqual(['UN-001']);
  });
});

describe('arquivos repetidos', () => {
  it('o mesmo conteúdo tem o mesmo hash e conteúdos diferentes, não', async () => {
    const a = await hashArquivo(new Blob(['%PDF-1.4 igual']));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashArquivo(new Blob(['%PDF-1.4 igual']))).toBe(a);
    expect(await hashArquivo(new Blob(['%PDF-1.4 outro']))).not.toBe(a);
  });

  it('resume o espaço contando anexos idênticos uma só vez', () => {
    const base = { entidade: 'unidade', entidade_id: 'U', categoria: '', nome: 'x.pdf', criado_em: '', criado_por: '' } as const;
    const r = resumirAnexos([
      { ...base, id: '1', tamanho: 100, hash: 'h1' },
      { ...base, id: '2', tamanho: 100, hash: 'h1' },
      { ...base, id: '3', tamanho: 50, hash: '' },
    ]);
    expect(r).toEqual({ anexos: 3, arquivos: 2, bytesUsados: 150, pendentes: 1, bytesEconomizados: 100 });
  });
});
