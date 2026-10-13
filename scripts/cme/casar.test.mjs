import { describe, expect, it } from 'vitest';
import { casarResolucao, citadasNoCadastro, ehNormaGeral, idDaResolucao, nucleo, relacao } from './casar.mjs';

const unidades = [
  { id: 'UN-003', inep: '15040720', nome: 'ESCOLA MUNICIPAL PROF MIGUEL PERNAMBUCO FILHO', ato_autorizacao: '072/2018 - CME, DE 18/12/2018' },
  { id: 'UN-216', inep: '15000216', nome: 'ESCOLA MUNICIPAL JOAO NELSON RIBEIRO', ato_autorizacao: '' },
  { id: 'UN-212', inep: '15000212', nome: 'ESCOLA MUNICIPAL JOAO NELSON RIBEIRO I', ato_autorizacao: '' },
  { id: 'UN-045', inep: '15000045', nome: 'ESCOLA MUNICIPAL PRATINHA', ato_autorizacao: '' },
  { id: 'UN-100', inep: '15000100', nome: 'ESCOLA MUNICIPAL PADRE LEANDRO PINHEIRO', ato_autorizacao: '' },
];
const citadas = citadasNoCadastro(unidades);

describe('relação e normas gerais', () => {
  it('tira a relação do verbo da descrição', () => {
    expect(relacao('Renova a autorização de funcionamento da Educação Infantil…')).toBe('renovação de autorização');
    expect(relacao('Concede credenciamento à entidade X e autorização…')).toBe('credenciamento');
    expect(relacao('Prorroga a autorização de funcionamento…')).toBe('prorrogação de autorização');
    expect(relacao('Autoriza o funcionamento da Escola X')).toBe('autorização de funcionamento');
    expect(relacao('Validação de estudos de aluno')).toBeNull();
    expect(relacao('Aprova o calendário especial')).toBeNull();
  });

  it('reconhece norma geral', () => {
    expect(ehNormaGeral('Estabelece normas para autorização de funcionamento')).toBe(true);
    expect(ehNormaGeral('Prorrogam-se os termos da Resolução nº 27/2017.')).toBe(true);
    expect(ehNormaGeral('Autoriza o funcionamento da Escola Municipal X')).toBe(false);
  });
});

describe('núcleo do nome', () => {
  it('tira "Escola Municipal", "Profª" e o "da EM …" dos anexos', () => {
    expect(nucleo('ESCOLA MUNICIPAL PROF MIGUEL PERNAMBUCO FILHO')).toBe('MIGUEL PERNAMBUCO FILHO');
    expect(nucleo('ANEXO BARAO DE MAMORE DA EM FRANCISCO DA SILVA NUNES')).toBe('BARAO MAMORE');
  });
});

describe('casarResolucao', () => {
  it('liga com confiança alta a resolução que o próprio cadastro cita', () => {
    const r = casarResolucao({ ano: 2018, numero: 72, descricao: 'Renova a autorização da escola de nome qualquer' }, unidades, citadas);
    expect(r).toEqual([{ id: 'UN-003', inep: '15040720', relacao: 'renovação de autorização', confianca: 'alta' }]);
  });

  it('liga pelo nome na descrição, como "provável"', () => {
    const r = casarResolucao({ ano: 2020, numero: 9, descricao: 'Autoriza o funcionamento da Escola Municipal "Padre Leandro Pinheiro" - Belém/PA.' }, unidades, citadas);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: 'UN-100', confianca: 'media', relacao: 'autorização de funcionamento' });
    expect(r[0].nota).toMatch(/Confira/);
  });

  it('usa o nome do arquivo quando a descrição é curta', () => {
    const r = casarResolucao({ ano: 2024, numero: 3, descricao: 'Renova a autorização.', arquivo: 'Res03_2024_EM Padre Leandro Pinheiro' }, unidades, citadas);
    expect(r.map((x) => x.id)).toEqual(['UN-100']);
  });

  it('entre "João Nelson Ribeiro" e "… I", fica a variante que o texto nomeia', () => {
    const base = casarResolucao({ ano: 2020, numero: 1, descricao: 'Autoriza a Escola Municipal João Nelson Ribeiro.' }, unidades, citadas);
    expect(base.map((x) => x.id)).toEqual(['UN-216']);
    const um = casarResolucao({ ano: 2020, numero: 2, descricao: 'Autoriza a Escola Municipal João Nelson Ribeiro I.' }, unidades, citadas);
    expect(um.map((x) => x.id)).toEqual(['UN-212']);
  });

  it('nome de uma palavra só vale com termo de escola antes (Pratinha também é bairro)', () => {
    expect(casarResolucao({ ano: 2020, numero: 4, descricao: 'Renova a autorização da Escola Municipal Pratinha.' }, unidades, citadas).map((x) => x.id)).toEqual(['UN-045']);
    expect(casarResolucao({ ano: 2020, numero: 5, descricao: 'Credencia a entidade X, no bairro Pratinha.' }, unidades, citadas)).toEqual([]);
  });

  it('não liga quando nenhuma unidade corresponde', () => {
    expect(casarResolucao({ ano: 2020, numero: 6, descricao: 'Credencia o Centro Social Auxilium e autoriza a Educação Infantil.' }, unidades, citadas)).toEqual([]);
  });
});

describe('idDaResolucao', () => {
  it('numera três dígitos e acrescenta sufixo quando o número já existe no ano', () => {
    const usados = new Set(['res-2012-001']);
    expect(idDaResolucao(2012, 1, usados)).toBe('res-2012-001-1');
    expect(idDaResolucao(2012, 1, usados)).toBe('res-2012-001-2');
    expect(idDaResolucao(2026, 7, usados)).toBe('res-2026-007');
  });
});
