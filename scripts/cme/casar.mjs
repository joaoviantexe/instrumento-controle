/**
 * Regras (sem IA) que ligam uma resolução do CME às unidades do cadastro.
 * Funções puras: não acessam a rede nem o disco.
 *
 * Duas formas de ligação, da mais para a menos segura:
 *  1. "alta": o próprio cadastro cita a resolução no campo "Ato de autorização" (ex.: "072/2018 - CME, DE 18/12/2018").
 *  2. "media": o nome da unidade aparece por inteiro na descrição ou no nome do arquivo. Vai para a Conferência de atos,
 *     onde alguém confirma ou recusa.
 */

const GENERICAS = new Set(
  `ESCOLA ESCOLAS MUNICIPAL MUNICIPAIS DE DA DO DOS DAS E EM EDUCACAO INFANTIL ENSINO FUNDAMENTAL CAMPO QUILOMBOLA PROFESSORA PROFESSOR PROF PROFA
PROFO ANEXO ANEXA UNIDADE UNIDADES UEI EMEI EMEIF EMEF EMEC EMEQ UMEI UMEIF UP PEDAGOGICA CENTRO OSC INSTITUTO ASSOCIACAO SR SRA NOSSA SENHORA`.split(/\s+/),
);

/** Maiúsculas, sem acentos nem pontuação, com espaços únicos. */
export const normalizar = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/-\s*\n\s*/g, '')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Parte distintiva do nome: sem "Escola Municipal", "Profª", e sem o "da EM …" dos anexos ("ANEXO X DA EM Y" → "X"). */
export function nucleo(nome) {
  let n = normalizar(nome);
  n = n.split(/\b(?:DA|DO) (?:EM|EMEI|EMEIF|EMEF|ESCOLA MUNICIPAL|EM DE EDUC)\b/)[0];
  n = n.replace(/\bOSC\b.*$/, '');
  return n
    .split(' ')
    .filter((t) => t && !GENERICAS.has(t))
    .join(' ');
}

const SEM_GENERICAS = (texto) =>
  normalizar(texto)
    .split(' ')
    .filter((t) => !GENERICAS.has(t))
    .join(' ');

const TIPO_ESCOLA = /\b(ESCOLA|EMEI|EMEIF|EMEF|EMEC|EMEQ|UMEI|UMEIF|UEI|UP|UNIDADE|CRECHE|LICEU|ANEXO|ANEXA)\b/;
const VIA = /\b(BAIRRO|DISTRITO|RUA|PASSAGEM|TRAVESSA|AVENIDA|CONJUNTO|ESTRADA|ILHA)\s*(D[AEO]S?\s+)?$/;

/** Relação que o ato tem com a unidade, tirada do verbo da descrição; null para o que não trata de funcionamento. */
export function relacao(descricao) {
  const x = String(descricao ?? '').toLowerCase();
  if (/^(valida|validação|convalida|aprova calendário|aprova o calendário)/.test(x)) return null;
  if (/prorroga/.test(x)) return 'prorrogação de autorização';
  if (/prazo .* regulariza/.test(x)) return 'prazo de regularização';
  if (/recredencia/.test(x)) return 'recredenciamento';
  if (/credencia/.test(x)) return 'credenciamento';
  if (/renova|renovação/.test(x)) return 'renovação de autorização';
  if (/autoriza definitivamente/.test(x)) return 'autorização de funcionamento';
  if (/autoriza|autorizar|autorizo|concede autorização|autorização de/.test(x)) return 'autorização de funcionamento';
  return null;
}

/** Norma geral do CME (regras, composição, calendário…): não trata de uma escola em particular. */
export const ehNormaGeral = (descricao) =>
  /^(estabelece|fixa|disp[õo]e|regulamenta|define|aprova (o|a|as|os) (regimento|calend|plano|composi|atribui|normas|estudo)|determina|altera|revoga|institui (o|a) (sistema|programa|comiss|grupo)|convalid|valida|prorrogam-se os termos)/i.test(
    String(descricao ?? '').trim(),
  );

/**
 * Resoluções do CME citadas no cadastro: mapa "AAAA|N" → ids das unidades. O formato é "072/2018 - CME" (número/ano).
 * @param {{id: string, ato_autorizacao?: string}[]} unidades
 */
export function citadasNoCadastro(unidades) {
  const mapa = new Map();
  for (const u of unidades) {
    for (const m of String(u.ato_autorizacao ?? '').matchAll(/(\d{1,3})\s*\/\s*(\d{4})\s*-?\s*CME/gi)) {
      const k = `${m[2]}|${Number(m[1])}`;
      mapa.set(k, [...(mapa.get(k) ?? []), u.id]);
    }
  }
  return mapa;
}

/** O núcleo do nome aparece no texto? Núcleo de uma palavra só vale com um termo de escola logo antes (PRATINHA também é bairro). */
function nomeNoTexto(nuc, texto) {
  if (!nuc || nuc.length < 3) return false;
  const t = normalizar(texto);
  const sq = SEM_GENERICAS(texto);
  if (nuc.includes(' ')) return new RegExp(`\\b${nuc}\\b`).test(sq);
  for (const m of t.matchAll(new RegExp(`\\b${nuc}\\b`, 'g'))) {
    const antes = t.slice(Math.max(0, m.index - 70), m.index);
    if (TIPO_ESCOLA.test(antes) && !VIA.test(antes)) return true;
  }
  return false;
}

/**
 * Liga uma resolução às unidades.
 * @param {{ano: number|string, numero: number, descricao: string, arquivo?: string}} res
 * @param {{id: string, inep: string, nome: string, ato_autorizacao?: string}[]} unidades
 * @param {Map<string, string[]>} citadas resultado de citadasNoCadastro
 * @returns {{id: string, inep: string, relacao: string, confianca: 'alta'|'media'|'baixa', nota?: string}[]}
 */
export function casarResolucao(res, unidades, citadas) {
  const rel = relacao(res.descricao) ?? 'autorização de funcionamento';
  const porId = new Map(unidades.map((u) => [u.id, u]));
  const doCadastro = citadas.get(`${res.ano}|${Number(res.numero)}`);
  if (doCadastro?.length) return doCadastro.map((id) => ({ id, inep: porId.get(id).inep, relacao: rel, confianca: 'alta' }));

  const texto = `${res.descricao} ${res.arquivo ?? ''}`;
  let achadas = unidades.map((u) => ({ u, nuc: nucleo(u.nome) })).filter(({ nuc }) => nomeNoTexto(nuc, texto));
  // "João Nelson Ribeiro" também casa dentro de "João Nelson Ribeiro I": fica a variante cujo núcleo é o mais completo.
  achadas = achadas.filter(({ nuc }) => !achadas.some((o) => o.nuc !== nuc && o.nuc.startsWith(nuc + ' ')));
  if (achadas.length === 0) return [];
  const varias = achadas.length > 1;
  return achadas.map(({ u }) => ({
    id: u.id,
    inep: u.inep,
    relacao: rel,
    confianca: varias ? 'baixa' : 'media',
    nota: varias
      ? 'Associada automaticamente pelo nome: há mais de uma unidade com nome parecido. Confira qual é.'
      : 'Associada automaticamente pelo nome na descrição da resolução. Confira se é esta unidade.',
  }));
}

/** Id de uma resolução nova: "res-AAAA-NNN", com sufixo quando já existe outra com o mesmo número no ano. */
export function idDaResolucao(ano, numero, usados) {
  const base = `res-${ano}-${String(numero).padStart(3, '0')}`;
  let id = base;
  for (let i = 1; usados.has(id); i++) id = `${base}-${i}`;
  usados.add(id);
  return id;
}
