import { describe, expect, it } from 'vitest';
import { LIMITE_BYTES, formatarTamanho, hashArquivo, resumirAnexos, verificarEspaco, unidadesComAto, validarPdf, CATEGORIA_ATO } from './anexos';
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

describe('limite de armazenamento', () => {
  const base = { entidade: 'unidade', entidade_id: 'U', categoria: '', nome: 'x.pdf', criado_em: '', criado_por: '' } as const;
  const MB = 1024 * 1024;
  const cheio = [{ ...base, id: '1', tamanho: 95 * MB, hash: 'h1' }];

  it('aceita enquanto couber abaixo da margem e recusa quando passar', () => {
    expect(verificarEspaco([], 94 * MB, 'n', 100 * MB)).toBeNull();
    expect(verificarEspaco([], 96 * MB, 'n', 100 * MB)).toContain('Limite de armazenamento atingido');
    expect(verificarEspaco(cheio, 1, 'n', 100 * MB)).toContain('atingido');
  });

  it('aceita arquivo idêntico a um já guardado, mesmo no limite', () => {
    expect(verificarEspaco(cheio, 50 * MB, 'h1', 100 * MB)).toBeNull();
  });
});

describe('tipos de documento da unidade', () => {
  it('lista em ordem alfabética, com Outro documento por último, e inclui as resoluções de funcionamento', async () => {
    const { CATEGORIAS } = await import('./anexos');
    const l = CATEGORIAS.unidade;
    expect(l).toContain('Resolução de Autorização de Funcionamento das Unidades Escolares - CME');
    expect(l).toContain('Resolução de Autorização de Funcionamento das OSCs - CME');
    expect(l[l.length - 1]).toBe('Outro documento');
    const meio = l.slice(0, -1);
    expect(meio).toEqual([...meio].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  });

  it('as resoluções de funcionamento (e o nome antigo) contam como PDF do ato', () => {
    const base = { entidade: 'unidade', categoria: '', nome: 'x.pdf', tamanho: 1, hash: '', destino: 'local', criado_em: '', criado_por: '' } as const;
    const set = unidadesComAto([
      { ...base, id: '1', entidade_id: 'A', categoria: 'Resolução de Autorização de Funcionamento das OSCs - CME' },
      { ...base, id: '2', entidade_id: 'B', categoria: 'Resolução de Autorização de Funcionamento das Unidades Escolares - CME' },
      { ...base, id: '3', entidade_id: 'C', categoria: 'Autorização de Funcionamento - CME' },
      { ...base, id: '4', entidade_id: 'D', categoria: 'Decreto' },
    ]);
    expect([...set].sort()).toEqual(['A', 'B', 'C']);
  });
});
