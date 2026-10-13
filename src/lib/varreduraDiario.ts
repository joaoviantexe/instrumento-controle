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

/** Maiúsculas, sem acentos, sem pontuação e com espaços únicos. */
export const normalizar = (s: string) =>
  s
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

/** Lê a linha de título de um ato ("PORTARIA Nº 583/2024 – GABS/SEMEC"). Citações em caixa mista dentro do texto são ignoradas. */
export function lerTitulo(linha: string): { tipo: string; numero: string; titulo: string } | null {
  const l = linha.trim().replace(/\s+/g, ' ');
  if (l.length < 8 || l.length > 170) return null;
  const letras = l.replace(/[^A-Za-zÀ-ÿ]/g, '');
  const maiusculas = letras.replace(/[^A-ZÀ-Ý]/g, '').length;
  const caixaAlta = letras.length > 0 && maiusculas / letras.length >= 0.7;
  // Edições antigas usam títulos em caixa mista ("Portaria Nº 536 / 07 – PMB Belém, 28 de Maio de 2007."). Nelas só vale
  // a linha que termina como um título; uma citação quebrada no meio da frase termina em vírgula ou conectivo.
  if (!caixaAlta && !/(\d{2,4}|PMB|GABS|SEMEC|CME|GP)\s*\.?$/i.test(l)) return null;
  const up = l.toUpperCase();
  for (const [tipo, re] of TIPOS) {
    if (!re.test(up)) continue;
    const m = up.match(/N\s*[º°O.]*\s*\.?\s*([0-9][0-9.]*\s*(?:\/\s*\d{2,4})?)/);
    if (!m && tipo !== 'Errata') return null;
    return { tipo, numero: m ? m[1].replace(/\s+/g, '') : '', titulo: l };
  }
  return null;
}

/** Divide as páginas de uma edição em atos; cada ato guarda a página onde começa e onde termina. */
export function separarAtos(paginas: PaginaTexto[]): AtoEncontrado[] {
  const atos: (AtoEncontrado & { linhas: string[] })[] = [];
  let atual: (AtoEncontrado & { linhas: string[] }) | null = null;
  for (const { pagina, texto } of paginas) {
    for (const linha of texto.split('\n')) {
      const t = lerTitulo(linha);
      if (t) {
        atual = { ...t, pagina, texto: '', linhas: [linha] };
        atos.push(atual);
      } else if (atual) {
        atual.linhas.push(linha);
        if (pagina !== atual.pagina) atual.pagina_final = pagina;
      }
    }
  }
  return atos.map(({ linhas, ...a }) => {
    const texto = linhas.join('\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    return { ...a, texto: texto.length > MAX_TEXTO_ATO ? texto.slice(0, MAX_TEXTO_ATO) + ' […]' : texto };
  });
}

/** Termos que indicam uma escola ou unidade de ensino. */
const ESCOLA =
  /\b(ESCOLAS?|E ?M ?E ?I ?F?|EMEF|EMEC|EMEQ|U ?M ?E ?I ?F?|UMEF|U ?E ?I|UEIS|UNIDADES? DE EDUCACAO|UNIDADES? PEDAGOGICAS?|U ?P|UNIDADES? ESCOLAR(ES)?|UNIDADES? MUNICIPA(L|IS) DE (EDUCACAO|ENSINO)|CRECHES?|LICEU|ESCOLA ANEXA|ANEXOS? D[AO] (EM|EMEI|EMEF|EMEIF|EMEC|ESCOLA))\b/;
/** Termos que indicam um ato sobre a existência ou o funcionamento da unidade (não sobre pessoas). */
const INSTITUCIONAL =
  /\b(CRIA|CRIAR|CRIADAS?|CRIADOS?|CRIACAO|INSTITUI|INSTITUIR|INSTITUIDAS?|INSTITUICAO DA|INSTITUICAO DO|EXTINTAS?|EXTINTOS?|EXTINGUE|EXTINGUIR|EXTINCAO|DENOMINA|DENOMINAR|DENOMINADAS?|DENOMINACAO|NOMENCLATURA|PASSA A SE DENOMINAR|ALTERA O NOME|TRANSFORMA|TRANSFORMADAS?|TRANSFORMACAO|VINCULA|VINCULAR|VINCULACAO|DESATIVA|DESATIVACAO|PARALISA|PARALISACAO|REATIVA|FUSAO|INCORPORA|INCORPORACAO|CREDENCIA|CREDENCIAMENTO|RECREDENCIAMENTO|RECONHECE|RECONHECIMENTO|REGIMENTO ESCOLAR)\b|AUTORIZ\w* (O |DE )?FUNCIONAMENTO|RENOV\w* (DA )?AUTORIZACAO|FUNCIONAMENTO D[AO] (EDUCACAO|ENSINO)/;

/** Ato que fala de escola e trata da criação, extinção, nome ou funcionamento de uma unidade. */
export function atoInstitucionalDeEscola(ato: AtoEncontrado): boolean {
  const t = normalizar(ato.texto);
  return ESCOLA.test(t) && INSTITUCIONAL.test(t);
}

/** Uma edição sem camada de texto (digitalizada) não pode ser lida sem OCR. */
export function semTexto(paginas: PaginaTexto[]): boolean {
  const total = paginas.reduce((s, p) => s + p.texto.replace(/\s+/g, '').length, 0);
  return total < 150 * Math.max(1, paginas.length);
}

/** Atos relevantes de uma edição. */
export function atosDaEdicao(paginas: PaginaTexto[]): AtoEncontrado[] {
  return separarAtos(paginas).filter(atoInstitucionalDeEscola);
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
