// Regras (sem IA) para achar, no texto do Diário Oficial, atos que citam as unidades do cadastro.
// Funções puras: recebem texto e o cadastro e devolvem dados; não leem arquivos nem a rede.

/** Maiúsculas, sem acentos, sem pontuação e com espaços únicos: "Escola Mun. São José" → "ESCOLA MUN SAO JOSE". */
export const normalizar = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const TIPOS = [
  ['DECRETO', /^DECRETO\b/],
  ['PORTARIA', /^PORTARIA\b/],
  ['RESOLUÇÃO', /^RESOLU[CÇ][AÃ]O\b/],
  ['LEI COMPLEMENTAR', /^LEI\s+COMPLEMENTAR\b/],
  ['LEI', /^LEI\b/],
  ['INSTRUÇÃO NORMATIVA', /^INSTRU[CÇ][AÃ]O\s+NORMATIVA\b/],
  ['PARECER', /^PARECER\b/],
  ['EDITAL', /^EDITAL\b/],
  ['EXTRATO', /^EXTRATO\b/],
  ['ERRATA', /^ERRATA\b/],
];

/** Linha de título de um ato, ex.: "PORTARIA Nº 583/2024 – GABS/SEMEC". Devolve { tipo, numero, titulo } ou null. */
export function lerTitulo(linha) {
  const l = linha.trim().replace(/\s+/g, ' ');
  if (l.length > 160) return null;
  const up = l.toUpperCase().replace(/PORTARI\s+A/, 'PORTARIA');
  const letras = l.replace(/[^A-Za-zÀ-ÿ]/g, '');
  const maiusculas = letras.replace(/[^A-ZÀ-Ý]/g, '').length;
  // Título de ato vem em maiúsculas; "Decreto nº ..." em caixa mista é citação dentro do texto.
  const emCaixaAlta = letras.length > 0 && maiusculas / letras.length >= 0.7;
  for (const [tipo, re] of TIPOS) {
    if (!re.test(up)) continue;
    if (!emCaixaAlta && !['EXTRATO', 'ERRATA', 'EDITAL'].includes(tipo)) return null;
    const m = up.match(/N\s*[º°O.]*\s*([0-9][0-9.]*\s*\/?\s*\d{0,4})/);
    // Títulos de verdade trazem número; "Decreto nº..." no meio de uma frase não começa a linha.
    if (!m && tipo !== 'EXTRATO' && tipo !== 'ERRATA' && tipo !== 'EDITAL') return null;
    return { tipo, numero: m ? m[1].replace(/\s+/g, '') : '', titulo: l };
  }
  return null;
}

/**
 * Divide o texto das páginas em atos. `paginas` = [{ pagina, texto }].
 * Cada ato guarda a página onde começa e a página onde termina.
 */
export function separarAtos(paginas) {
  const atos = [];
  let atual = null;
  for (const { pagina, texto } of paginas) {
    for (const linha of texto.split('\n')) {
      const t = lerTitulo(linha);
      if (t) {
        atual = { ...t, pagina_inicial: pagina, pagina_final: pagina, linhas: [linha] };
        atos.push(atual);
      } else if (atual) {
        atual.linhas.push(linha);
        atual.pagina_final = pagina;
      }
    }
  }
  return atos.map(({ linhas, ...a }) => ({ ...a, texto: linhas.join('\n') }));
}

/** O que o ato faz com a unidade (heurística por palavras; serve de rótulo inicial para o revisor). */
export function finalidade(texto) {
  const t = normalizar(texto);
  if (/\bEXTINT[AO]\b|\bEXTINGUE\b|\bEXTINCAO\b/.test(t)) return 'extinção';
  if (/\bCRIA\b|\bCRIACAO\b|\bFICA CRIAD[AO]\b/.test(t)) return 'criação';
  if (/AUTORIZA.{0,40}FUNCIONAMENTO|FUNCIONAMENTO.{0,40}AUTORIZ/.test(t)) return 'autorização de funcionamento';
  if (/\bRENOVA|RECREDENCIA|CREDENCIA/.test(t)) return 'renovação / credenciamento';
  if (/\bDESATIVA|\bPARALISA/.test(t)) return 'desativação';
  if (/\bDENOMINA|\bPASSA A SE DENOMINAR|\bALTERA .{0,30}NOME/.test(t)) return 'denominação';
  return 'outro';
}

const TERMOS_ESCOLA = /\b(ESCOLA|EMEF|EMEI|EMEIF|UMEI|UEI|CRECHE|UNIDADES? ESCOLARES?|UNIDADES? DE EDUCACAO|CENTRO DE EDUCACAO)\b/;

/** Indexa o cadastro para busca por INEP e por nome. Nomes curtos demais ficam de fora (geram falso positivo). */
export function indexarUnidades(unidades) {
  const porInep = new Map();
  const nomes = [];
  for (const u of unidades) {
    if (u.inep) porInep.set(String(u.inep), u);
    const n = normalizar(u.nome);
    if (n.length >= 15) nomes.push({ n, u });
  }
  return { porInep, nomes };
}

/** Procura as unidades citadas por um ato. Devolve [{ unidade, confianca, motivo }]. */
export function acharUnidades(ato, indice) {
  const achadas = new Map();
  const texto = ato.texto;
  for (const m of texto.matchAll(/\b(15\d{6})\b/g)) {
    const u = indice.porInep.get(m[1]);
    if (u) achadas.set(u.id, { unidade: u, confianca: 'alta', motivo: `INEP ${m[1]}` });
  }
  const norm = normalizar(texto);
  for (const { n, u } of indice.nomes) {
    if (achadas.has(u.id)) continue;
    if (norm.includes(n)) achadas.set(u.id, { unidade: u, confianca: 'média', motivo: 'nome da unidade' });
  }
  return [...achadas.values()];
}

/** Atos que falam de escola, mas não casaram com nenhuma unidade: vão para a leitura do Claude / revisão manual. */
export const parecePorEscola = (ato) => TERMOS_ESCOLA.test(normalizar(ato.texto));

export function trecho(ato, maximo = 600) {
  const t = ato.texto.replace(/\s+/g, ' ').trim();
  return t.length > maximo ? t.slice(0, maximo) + '…' : t;
}

/** Roda tudo sobre as páginas de uma edição. */
export function analisarEdicao(paginas, unidades, meta = {}) {
  const indice = indexarUnidades(unidades);
  const sugestoes = [];
  const duvidosos = [];
  for (const ato of separarAtos(paginas)) {
    const achadas = acharUnidades(ato, indice);
    const base = {
      ...meta,
      tipo_documento: ato.tipo,
      numero: ato.numero,
      titulo: ato.titulo,
      pagina_inicial: ato.pagina_inicial,
      pagina_final: ato.pagina_final,
      finalidade: finalidade(ato.texto),
      trecho: trecho(ato),
    };
    if (achadas.length) {
      for (const a of achadas) {
        sugestoes.push({ ...base, unidade_id: a.unidade.id, unidade_nome: a.unidade.nome, inep: a.unidade.inep, confianca: a.confianca, motivo: a.motivo });
      }
    } else if (parecePorEscola(ato)) {
      duvidosos.push(base);
    }
  }
  return { sugestoes, duvidosos };
}
