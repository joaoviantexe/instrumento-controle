import { describe, expect, it } from 'vitest';
import paginas from './__fixtures__/dom-14916-paginas-5-7.json';
import { atoInstitucionalDeEscola, atosDaEdicao, lerListaEdicoes, lerTitulo, MAX_TEXTO_ATO, semTexto, separarAtos } from './varreduraDiario';

describe('títulos de atos', () => {
  it('reconhece títulos em maiúsculas, inclusive com espaço quebrado ("PORTARI A")', () => {
    expect(lerTitulo('PORTARIA Nº 583/2024 – GABS/SEMEC')).toMatchObject({ tipo: 'Portaria', numero: '583/2024' });
    expect(lerTitulo('PORTARI A Nº 582/2024 – GABS/SEMEC')).toMatchObject({ tipo: 'Portaria', numero: '582/2024' });
    expect(lerTitulo('DECRETO Nº. 110.038/2024 – PMB, DE 25 DE MARÇO DE 2024.')).toMatchObject({ tipo: 'Decreto', numero: '110.038/2024' });
    expect(lerTitulo('RESOLUÇÃO Nº. 21 – CME, DE 05 DE NOVEMBRO DE 2014')).toMatchObject({ tipo: 'Resolução' });
  });
  it('reconhece os títulos em caixa mista das edições antigas', () => {
    expect(lerTitulo('Portaria Nº 539 / 07 – PMB Belém, 28 de Maio de 2007.')).toMatchObject({ tipo: 'Portaria', numero: '539/07' });
  });
  it('ignora citações de atos no meio do texto', () => {
    expect(lerTitulo('Decreto Nº 29.107/96-PMB, de 20 de agosto de 1996 e,')).toBeNull();
    expect(lerTitulo('Decreto nº 109.372/2024 – PMB, de 17 de janeiro de 2024, e')).toBeNull();
    expect(lerTitulo('Considerando o Decreto 107.640, de 23 de junho de 2023')).toBeNull();
  });
});

describe('separação e filtro dos atos (texto real da edição 14.916, de 25/03/2024)', () => {
  const atos = atosDaEdicao(paginas);

  it('encontra as portarias de extinção da EMEIF Satélite e da EMEIF Angelus Nascimento, na página 6', () => {
    const p583 = atos.find((a) => a.numero === '583/2024');
    const p582 = atos.find((a) => a.numero === '582/2024');
    expect(p583).toMatchObject({ tipo: 'Portaria', pagina: 6 });
    expect(p583!.texto).toContain('SATÉLITE');
    expect(p582!.texto).toContain('15043398');
  });

  it('deixa de fora atos que não tratam da existência ou do funcionamento de escolas', () => {
    const todos = separarAtos(paginas);
    expect(todos.length).toBeGreaterThan(atos.length);
    // Portarias de fiscalização de contratos citam a SEMEC e "Unidades Escolares", mas não criam nem extinguem nada.
    expect(todos.some((a) => a.numero === '551/2024')).toBe(true);
    expect(atos.some((a) => a.numero === '551/2024')).toBe(false);
  });

  it('cada ato começa num título e guarda a página', () => {
    for (const a of atos) {
      expect(a.texto.startsWith(a.titulo.slice(0, 10))).toBe(true);
      expect(a.pagina).toBeGreaterThanOrEqual(5);
    }
  });

  it('um ato que continua na página seguinte guarda a página final', () => {
    const [ato] = separarAtos([
      { pagina: 2, texto: 'DECRETO Nº 85.697-PMB, DE 9 DE MAIO DE 2016.\nDispõe sobre a criação de Escola Municipal\n' },
      { pagina: 3, texto: 'Art. 1º Fica criada a Escola Municipal de Educação Infantil Jardim Nova Vida.\n' },
    ]);
    expect(ato).toMatchObject({ pagina: 2, pagina_final: 3 });
    expect(atoInstitucionalDeEscola(ato)).toBe(true);
  });
});

describe('outros', () => {
  it('detecta edições digitalizadas, sem camada de texto', () => {
    expect(semTexto([{ pagina: 1, texto: ' ' }, { pagina: 2, texto: '3' }])).toBe(true);
    expect(semTexto(paginas)).toBe(false);
  });

  it('lê a lista de edições do painel', () => {
    const r = lerListaEdicoes({
      response: { numFound: 5147, docs: [{ id: '15525', data_publicacao: '2026-10-07T03:00:00Z', attr_stream_name: ['dom_07-10-26.pdf'] }] },
    });
    expect(r).toEqual({ total: 5147, edicoes: [{ id: 15525, data: '2026-10-07', arquivo: 'dom_07-10-26.pdf' }] });
    expect(lerListaEdicoes(null)).toEqual({ total: 0, edicoes: [] });
  });
});

describe('varredura: correções da revisão', () => {
  const pag = (texto: string, pagina = 1) => [{ pagina, texto }];

  it('avalia a relevância no texto completo do ato, antes de reduzi-lo', () => {
    const texto = ['PORTARIA Nº 1/2024 – GABS/SEMEC', ...Array(1500).fill('linha de tabela sem relação 123456'), 'Fica criada a Escola Municipal Tal.'].join('\n');
    const atos = atosDaEdicao(pag(texto));
    expect(atos).toHaveLength(1);
    expect(atos[0].texto.length).toBeLessThanOrEqual(MAX_TEXTO_ATO + 20);
    expect(atos[0].texto).toContain('Fica criada a Escola Municipal Tal');
  });

  it('desfaz a hifenização do fim da linha', () => {
    expect(atoInstitucionalDeEscola({ tipo: 'Portaria', numero: '1', titulo: '', pagina: 1, texto: 'Fica extin -\nta a Escola Municipal X' })).toBe(true);
    expect(atoInstitucionalDeEscola({ tipo: 'Portaria', numero: '1', titulo: '', pagina: 1, texto: 'Fica insti-\ntuída a Escola X' })).toBe(true);
    expect(atoInstitucionalDeEscola({ tipo: 'Portaria', numero: '1', titulo: '', pagina: 1, texto: 'autoriza o funcionamen -\nto da escola X' })).toBe(true);
    const atos = separarAtos(pag('PORTARIA Nº 2/2024 – SEMEC\nFica cria -\nda a Escola X'));
    expect(atos[0].texto).toContain('criada');
  });

  it('reconhece as flexões comuns de desativação, transformação, vínculo e reconhecimento', () => {
    for (const t of ['Fica desativada a EMEI Sol', 'Fica transformado o Centro de Educação Infantil em Escola', 'Fica reconhecida a Escola Z', 'Fica vinculada a EMEI X à Escola Y', 'Fica instituído o Colégio Municipal W']) {
      expect(atoInstitucionalDeEscola({ tipo: 'Decreto', numero: '1', titulo: '', pagina: 1, texto: t }), t).toBe(true);
    }
  });

  it('une o título com o número que ficou na linha seguinte e aceita letras espaçadas', () => {
    expect(separarAtos(pag('PORTARIA\nNº 583/2024 – GABS/SEMEC\nFica extinta a Escola X.'))[0]).toMatchObject({ tipo: 'Portaria', numero: '583/2024' });
    expect(lerTitulo('P O R T A R I A Nº 10/2024 – SEMEC')).toMatchObject({ tipo: 'Portaria', numero: '10/2024' });
  });

  it('descarta o cabeçalho e o rodapé repetidos em cada página', () => {
    const p1 = 'PORTARIA Nº 5/2024 – SEMEC\nFica criada a Escola X.\nAno LXV - Nº 14.916';
    const p2 = '7 DIÁRIO OFICIAL\nDO MUNICÍPIO DE BELÉM\nSEGUNDA-FEIRA, 25 DE MARÇO DE 2024\nOutro texto da portaria.';
    const [ato] = separarAtos([
      { pagina: 6, texto: p1 },
      { pagina: 7, texto: p2 },
    ]);
    expect(ato.pagina_final).toBe(7);
    expect(ato.texto).not.toMatch(/DI[ÁA]RIO OFICIAL|SEGUNDA-FEIRA|Ano LXV/);
  });

  it('não corta o ato numa citação de caixa mista que termina em número', () => {
    expect(lerTitulo('Portaria nº 12/2020, de 3 de março, conforme o Decreto 1234')).toBeNull();
    expect(lerTitulo('conforme a Portaria nº 500/2018')).toBeNull();
    expect(lerTitulo('Portaria Nº 539 / 07 – PMB Belém, 28 de Maio de 2007.')).toMatchObject({ numero: '539/07' });
    expect(lerTitulo('Portaria Nº 700 / 07 – SEMEC')).toMatchObject({ numero: '700/07' });
  });

  it('exige o termo de escola perto do termo institucional (ato que engoliu outros assuntos não passa)', () => {
    const longe = ['PORTARIA Nº 3/2024 – SEMOB', 'Fica criada a faixa exclusiva de ônibus.', ...Array(80).fill('texto de trânsito sem relação nenhuma com o assunto'), 'Escola Bosque - FUNBOSQUE, sede.'].join('\n');
    expect(atosDaEdicao(pag(longe))).toHaveLength(0);
    expect(atosDaEdicao(pag('PORTARIA Nº 4/2024 – SEMEC\nFica criada a Escola Municipal Tal.'))).toHaveLength(1);
  });

  it('reconhece variações de escola (colégio, centro de educação infantil, unid. pedagógica)', () => {
    for (const t of ['Fica criado o Colégio Municipal X', 'Fica criado o Centro Municipal de Educação Infantil Y', 'Fica criada a Unid. Pedagógica Z']) {
      expect(atoInstitucionalDeEscola({ tipo: 'Decreto', numero: '1', titulo: '', pagina: 1, texto: t }), t).toBe(true);
    }
  });
});
