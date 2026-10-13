/**
 * Varredura do Diário Oficial: regras (sem IA) que separam, no texto de uma edição, os atos institucionais
 * que falam de escolas — criação, instituição, extinção, denominação, mudança de nome, autorização de
 * funcionamento etc. A associação com as unidades do cadastro é feita depois, sobre o arquivo gerado.
 * Funções puras: não acessam a rede nem o navegador.
 */

export interface PaginaTexto {
  /** Página do PDF da edição (1 = primeira), a mesma usada pelo link #page=N. */
  pagina: number;
  texto: string;
}

export interface AtoEncontrado {
  tipo: string;
  numero: string;
  titulo: string;
  pagina: number;
  pagina_final?: number;
  texto: string;
}

export interface Edicao {
  id: number;
  /** AAAA-MM-DD */
  data: string;
  arquivo: string;
}

/** Tamanho máximo do texto guardado de cada ato (decretos com listas de escolas podem ser longos). */
export const MAX_TEXTO_ATO = 8000;

/** Junta as palavras partidas no fim da linha ("extin -\nta" vira "extinta"). */
export const desfazerHifenizacao = (s: string) => s.replace(/(\p{L})\s*-\s*\n\s*(\p{L})/gu, '$1$2');

/** Maiúsculas, sem acentos, sem pontuação e com espaços únicos. */
export const normalizar = (s: string) =>
  desfazerHifenizacao(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const TIPOS: [string, RegExp][] = [
  ['Decreto', /^DECRETO\b/],
  ['Portaria', /^PORTARI\s?A\b/],
  ['Resolução', /^RESOLU[CÇ][AÃ]O\b/],
  ['Lei Complementar', /^LEI\s+COMPLEMENTAR\b/],
  ['Lei', /^LEI\b/],
  ['Instrução Normativa', /^INSTRU[CÇ][AÃ]O\s+NORMATIVA\b/],
  ['Parecer', /^PARECER\b/],
  ['Errata', /^ERRATA\b/],
];

const PALAVRAS_TITULO = ['DECRETO', 'PORTARIA', 'RESOLUÇÃO', 'RESOLUCAO', 'PARECER', 'ERRATA', 'INSTRUÇÃO', 'LEI'];

/** "P O R T A R I A Nº 10" (letras espaçadas) volta a ser "PORTARIA Nº 10". Só mexe na palavra que abre o título. */
function juntarLetras(linha: string): string {
  for (const palavra of PALAVRAS_TITULO) {
    const re = new RegExp('^' + [...palavra].join(' ?') + '(?=\\s|$)', 'i');
    if (re.test(linha)) return linha.replace(re, palavra);
  }
  return linha;
}

/** Lê a linha de título de um ato ("PORTARIA Nº 583/2024 – GABS/SEMEC"). Citações em caixa mista dentro do texto são ignoradas. */
export function lerTitulo(linha: string): { tipo: string; numero: string; titulo: string } | null {
  const l = juntarLetras(linha.trim()).replace(/\s+/g, ' ');
  if (l.length < 8 || l.length > 170) return null;
  const letras = l.replace(/[^A-Za-zÀ-ÿ]/g, '');
  const maiusculas = letras.replace(/[^A-ZÀ-Ý]/g, '').length;
  const caixaAlta = letras.length > 0 && maiusculas / letras.length >= 0.7;
  // Edições antigas usam títulos em caixa mista ("Portaria Nº 536 / 07 – PMB Belém, 28 de Maio de 2007."). Nelas só vale
  // a linha que termina como um título (ano ou sigla do órgão) e não parece o começo de uma frase: uma citação quebrada no
  // meio do texto ("... conforme a Portaria nº 12/2020, de") tem vírgula, ponto e vírgula ou conectivo.
  if (!caixaAlta) {
    const terminaComoTitulo = /(\d{2,4}|\b[A-Z]{2,}(?:\/[A-Z]{2,})*)\s*\.?$/.test(l);
    const pareceFrase = /[;(]|,(?!\s*de\s+\d)|\b(que|conforme|nos termos|de acordo|segundo|cf\.?)\b/i.test(l.replace(/Bel[ée]m,/gi, 'Belém'));
    if (!terminaComoTitulo || pareceFrase) return null;
  }
  const up = l.toUpperCase();
  for (const [tipo, re] of TIPOS) {
    if (!re.test(up)) continue;
    const m = up.match(/N\s*[º°O.]*\s*\.?\s*([0-9][0-9.]*\s*(?:\/\s*\d{2,4})?)/);
    if (!m && tipo !== 'Errata') return null;
    return { tipo, numero: m ? m[1].replace(/\s+/g, '') : '', titulo: l };
  }
  return null;
}

/** Cabeçalho e rodapé que o jornal repete em cada página: número da página, nome do jornal, data e "Ano LXV - Nº …". */
const CABECALHO = /^\s*(\d{1,3}\s*)?(DI[ÁA]RIO OFICIAL|DO MUNIC[ÍI]PIO DE BEL[ÉE]M)\s*$|^\s*\d{1,3}\s*$|^\s*(SEGUNDA|TER[ÇC]A|QUARTA|QUINTA|SEXTA|S[ÁA]BADO|DOMINGO)(-FEIRA)?,.*\d{4}\s*$|^\s*Ano [IVXLC]+\s*-\s*N[º°o]\s*[\d.]+\s*$/i;

/** Texto da página sem o cabeçalho e o rodapé repetidos (que iriam parar no fim do ato da página anterior). */
export const semCabecalho = (texto: string) =>
  texto
    .split('\n')
    .filter((l) => !CABECALHO.test(l))
    .join('\n');

/** Começa como um título, mas o número ficou na linha seguinte ("PORTARIA" / "Nº 583/2024 – GABS/SEMEC"). */
const TIPO_SEM_NUMERO = /^\s*(DECRETO|PORTARIA|RESOLU[CÇ][AÃ]O|LEI)\b[^0-9]*$/i;

/** Divide as páginas de uma edição em atos, com o texto completo; cada ato guarda a página onde começa e onde termina. */
function agruparAtos(paginas: PaginaTexto[]): AtoEncontrado[] {
  const atos: (AtoEncontrado & { linhas: string[] })[] = [];
  let atual: (AtoEncontrado & { linhas: string[] }) | null = null;
  for (const { pagina, texto } of paginas) {
    const linhas = semCabecalho(texto).split('\n');
    for (let i = 0; i < linhas.length; i++) {
      let linha = linhas[i];
      let t = lerTitulo(linha);
      if (!t && TIPO_SEM_NUMERO.test(linha) && i + 1 < linhas.length) {
        const junta = linha.trim() + ' ' + linhas[i + 1].trim();
        t = lerTitulo(junta);
        if (t) {
          linha = junta;
          i++;
        }
      }
      if (t) {
        atual = { ...t, pagina, texto: '', linhas: [t.titulo] };
        atos.push(atual);
      } else if (atual) {
        atual.linhas.push(linha);
        if (pagina !== atual.pagina) atual.pagina_final = pagina;
      }
    }
  }
  return atos.map(({ linhas, ...a }) => ({
    ...a,
    texto: desfazerHifenizacao(linhas.join('\n')).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(),
  }));
}

/** Parte do início do ato que sempre é guardada, quando o texto passa do limite. */
const CABECA_TEXTO_ATO = 3000;

/**
 * Texto de um ato longo reduzido ao limite: guarda o começo e, se o primeiro termo de criação, extinção, nome ou funcionamento
 * vier depois dele, o trecho em volta (o ato pode ter engolido páginas inteiras de tabelas até o título seguinte).
 */
export function resumir(texto: string): string {
  if (texto.length <= MAX_TEXTO_ATO) return texto;
  const linhas = texto.split('\n');
  let n = 0;
  let i = 0;
  const cabeca: string[] = [];
  for (; i < linhas.length && n + linhas[i].length < CABECA_TEXTO_ATO; i++) {
    cabeca.push(linhas[i]);
    n += linhas[i].length + 1;
  }
  const k = linhas.findIndex((l, j) => j >= i && INSTITUCIONAL.test(normalizar(l)));
  const resto: string[] = [];
  let tam = n;
  for (let j = k < 0 ? i : Math.max(i, k - 8); j < linhas.length && tam + linhas[j].length < MAX_TEXTO_ATO; j++) {
    resto.push(linhas[j]);
    tam += linhas[j].length + 1;
  }
  const cortou = k >= 0 && Math.max(i, k - 8) > i;
  return cabeca.join('\n') + (cortou ? '\n […] \n' : ' […]') + (cortou || k < 0 ? resto.join('\n') : '');
}

/** Divide as páginas de uma edição em atos (com o texto reduzido ao limite). */
export function separarAtos(paginas: PaginaTexto[]): AtoEncontrado[] {
  return agruparAtos(paginas).map((a) => ({ ...a, texto: resumir(a.texto) }));
}

/** Termos que indicam uma escola ou unidade de ensino. */
const ESCOLA =
  /\b(ESCOLAS?|E ?M ?E ?I ?F?|EMEF|EMEC|EMEQ|U ?M ?E ?I ?F?|UMEF|U ?E ?I|UEIS|UNIDADES? DE EDUCACAO|UNIDADES? PEDAGOGICAS?|U ?P|UNIDADES? ESCOLAR(ES)?|UNIDADES? MUNICIPA(L|IS) DE (EDUCACAO|ENSINO)|CRECHES?|LICEU|COLEGIOS?|NUCLEOS? DE EDUCACAO|CENTROS? (MUNICIPA(L|IS) )?DE EDUCACAO INFANTIL|UNID PEDAGOGICAS?|ESCOLA ANEXA|ANEXOS? D[AO] (EM|EMEI|EMEF|EMEIF|EMEC|ESCOLA))\b/;
/** Termos que indicam um ato sobre a existência ou o funcionamento da unidade (não sobre pessoas). */
const INSTITUCIONAL =
  /\b(CRIA|CRIAR|CRIOU|CRIADAS?|CRIADOS?|CRIACAO|INSTITUI|INSTITUIR|INSTITUIDAS?|INSTITUIDOS?|INSTITUICAO DA|INSTITUICAO DO|EXTINTAS?|EXTINTOS?|EXTINGUE|EXTINGUIR|EXTINGUIDAS?|EXTINGUIDOS?|EXTINCAO|DENOMINA|DENOMINAR|DENOMINADAS?|DENOMINADOS?|DENOMINACAO|NOMENCLATURA|PASSA A SE DENOMINAR|ALTERA O NOME|TRANSFORMA|TRANSFORMAR|TRANSFORMAD[AO]S?|TRANSFORMACAO|VINCULA|VINCULAR|VINCULAD[AO]S?|VINCULACAO|DESATIVA|DESATIVAR|DESATIVAD[AO]S?|DESATIVACAO|PARALISA|PARALISAD[AO]S?|PARALISACAO|REATIVA|REATIVAD[AO]S?|FUSAO|INCORPORA|INCORPORAD[AO]S?|INCORPORACAO|CREDENCIA|CREDENCIAD[AO]S?|CREDENCIAMENTO|RECREDENCIAMENTO|RECONHECE|RECONHECID[AO]S?|RECONHECIMENTO|REGIMENTO ESCOLAR)\b|AUTORIZ\w* (O |DE )?FUNCIONAMENTO|RENOV\w* (DA )?AUTORIZACAO|FUNCIONAMENTO D[AO] (EDUCACAO|ENSINO)/;

/** Distância máxima (em caracteres) entre o termo de escola e o de criação, extinção, nome ou funcionamento. */
const JANELA = 400;

/**
 * Ato que fala de escola e trata da criação, extinção, nome ou funcionamento de uma unidade. Os dois termos precisam estar
 * perto um do outro: um ato que engoliu páginas de outros assuntos até o título seguinte não passa por ter "escola" numa
 * página e "cria" em outra.
 */
export function atoInstitucionalDeEscola(ato: AtoEncontrado): boolean {
  const t = normalizar(ato.texto);
  if (!ESCOLA.test(t)) return false;
  const re = new RegExp(INSTITUCIONAL.source, 'g');
  for (let m = re.exec(t); m; m = re.exec(t)) {
    if (ESCOLA.test(t.slice(Math.max(0, m.index - JANELA), m.index + m[0].length + JANELA))) return true;
  }
  return false;
}

/** Uma edição sem camada de texto (digitalizada) não pode ser lida sem OCR. */
export function semTexto(paginas: PaginaTexto[]): boolean {
  const total = paginas.reduce((s, p) => s + p.texto.replace(/\s+/g, '').length, 0);
  return total < 150 * Math.max(1, paginas.length);
}

/** Atos relevantes de uma edição. */
export function atosDaEdicao(paginas: PaginaTexto[]): AtoEncontrado[] {
  // A relevância é avaliada no texto completo do ato; só depois ele é reduzido ao limite.
  return agruparAtos(paginas)
    .filter(atoInstitucionalDeEscola)
    .map((a) => ({ ...a, texto: resumir(a.texto) }));
}

/** Converte a resposta da lista do painel ({response: {numFound, docs}}) em edições. */
export function lerListaEdicoes(dados: unknown): { total: number; edicoes: Edicao[] } {
  const r = (dados as { response?: { numFound?: number; docs?: Record<string, unknown>[] } })?.response;
  const edicoes = (r?.docs ?? [])
    .map((d) => {
      const nome = d.attr_stream_name;
      return {
        id: Number(d.id),
        data: String(d.data_publicacao ?? '').slice(0, 10),
        arquivo: String(Array.isArray(nome) ? nome[0] ?? '' : nome ?? ''),
      };
    })
    .filter((e) => Number.isInteger(e.id) && e.id > 0);
  return { total: Number(r?.numFound ?? edicoes.length), edicoes };
}
