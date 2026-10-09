import { describe, it, expect } from 'vitest';
import { lerTitulo, separarAtos, acharUnidades, indexarUnidades, finalidade, analisarEdicao } from './regras.mjs';

const unidades = [
  { id: 'UN-030', inep: '15169979', nome: 'ESCOLA MUNICIPAL PADRE BRUNO SECHI' },
  { id: 'UN-001', inep: '15548058', nome: 'ESCOLA MUNICIPAL PROFESSORA MARIA AUXILIADORA MARTINS GONCALVES' },
];

describe('lerTitulo', () => {
  it('reconhece o título de uma portaria, inclusive com o espaço do PDF ("PORTARI A")', () => {
    expect(lerTitulo('PORTARIA Nº 583/2024 – GABS/SEMEC')).toMatchObject({ tipo: 'PORTARIA', numero: '583/2024' });
    expect(lerTitulo('PORTARI A Nº 582/2024 – GABS/SEMEC')).toMatchObject({ tipo: 'PORTARIA', numero: '582/2024' });
  });
  it('ignora citação de decreto dentro do texto (caixa mista)', () => {
    expect(lerTitulo('Decreto Nº 29.107/96-PMB, de 20 de agosto de 1996 e,')).toBeNull();
  });
  it('aceita título de decreto em maiúsculas', () => {
    expect(lerTitulo('DECRETO Nº. 110.038/2024 – PMB, DE 25 DE MARÇO DE 2024.')).toMatchObject({ tipo: 'DECRETO' });
  });
});

describe('analisarEdicao', () => {
  const paginas = [
    { pagina: 5, texto: 'PORTARIA Nº 1/2024 – SEMAD\nNomeia servidores.\n' },
    {
      pagina: 6,
      texto:
        'PORTARIA Nº 583/2024 – GABS/SEMEC\nA SECRETÁRIA, no uso de suas atribuições e,\nDecreto Nº 29.107/96-PMB, de 20 de agosto de 1996 e,\nArt. 1°. FICA EXTINTA a EMEIF SATÉLITE, INEP 15169979, localizada na Travessa WE 8.\n',
    },
  ];
  it('associa o ato à unidade pelo INEP e guarda a página', () => {
    const { sugestoes } = analisarEdicao(paginas, unidades, { arquivo: 'x.pdf' });
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0]).toMatchObject({ tipo_documento: 'PORTARIA', numero: '583/2024', pagina_inicial: 6, unidade_id: 'UN-030', confianca: 'alta', finalidade: 'extinção' });
  });
  it('não associa atos que não citam nenhuma unidade', () => {
    const { sugestoes } = analisarEdicao([paginas[0]], unidades);
    expect(sugestoes).toHaveLength(0);
  });
  it('associa por nome quando não há INEP (confiança média)', () => {
    const ato = { texto: 'Fica autorizado o funcionamento da Escola Municipal Padre Bruno Sechi.' };
    expect(acharUnidades(ato, indexarUnidades(unidades))[0]).toMatchObject({ confianca: 'média' });
  });
});

describe('finalidade', () => {
  it('rotula criação, extinção e autorização de funcionamento', () => {
    expect(finalidade('FICA EXTINTA a escola')).toBe('extinção');
    expect(finalidade('Autoriza o funcionamento da escola')).toBe('autorização de funcionamento');
    expect(finalidade('Cria a Escola Municipal X')).toBe('criação');
  });
});
