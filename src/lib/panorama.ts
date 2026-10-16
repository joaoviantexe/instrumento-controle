/**
 * Panorama de Matrícula (relatório do SIGA, um por ano): as turmas de cada unidade, com ocupação e vagas.
 *
 * Este módulo não importa nada além de tipos, para que o script scripts/panorama/extrair.mjs (Node) use exatamente
 * a mesma leitura que o site usa quando o administrador envia a planilha de um ano.
 */
import type { Unidade } from './types';

/** Uma turma do panorama. */
export interface Turma {
  ensino: string;
  serie: string;
  turno: string;
  /** Código da turma no SIGA, ex.: C41302 (Ciclo IV, 1º ano, tarde, turma 02). */
  turma: string;
  /** Qt Ocupação Turma: capacidade. */
  ocupacao: number;
  /** Qt Alunos Turma. */
  alunos: number;
  nao_especial: number;
  especial: number;
  ocupacao_especial: number;
  /** Qt Vagas Restantes: negativo quando há mais alunos que a capacidade. */
  vagas: number;
}

/** Uma unidade do panorama e suas turmas. */
export interface UnidadePanorama {
  /** Cod Unidade (código da SEMEC no SIGA). */
  codigo: string;
  inep: string;
  nome: string;
  distrito: string;
  zona: string;
  bairro: string;
  tipo_contrato: string;
  rede: string;
  /** Unidade do Cadastro correspondente ('' quando não foi encontrada). */
  unidade_id: string;
  turmas: Turma[];
}

export interface Panorama {
  ano: number;
  /** Nome do arquivo de origem. */
  fonte: string;
  unidades: UnidadePanorama[];
}

/**
 * Forma compacta usada no arquivo embutido e no banco: cada turma vira uma lista na ordem de CAMPOS_TURMA
 * (o mesmo panorama ocupa menos da metade do espaço).
 */
export type TurmaCompacta = [string, string, string, string, number, number, number, number, number, number];
export interface PanoramaCompacto {
  ano: number;
  fonte: string;
  unidades: (Omit<UnidadePanorama, 'turmas'> & { turmas: TurmaCompacta[] })[];
}
const CAMPOS_TURMA = ['ensino', 'serie', 'turno', 'turma', 'ocupacao', 'alunos', 'nao_especial', 'especial', 'ocupacao_especial', 'vagas'] as const;

export function compactar(p: Panorama): PanoramaCompacto {
  return {
    ano: p.ano,
    fonte: p.fonte,
    unidades: p.unidades.map((u) => ({ ...u, turmas: u.turmas.map((t) => CAMPOS_TURMA.map((c) => t[c]) as TurmaCompacta) })),
  };
}

export function expandir(p: PanoramaCompacto): Panorama {
  return {
    ano: p.ano,
    fonte: p.fonte,
    unidades: p.unidades.map((u) => ({
      ...u,
      turmas: u.turmas.map((l) => Object.fromEntries(CAMPOS_TURMA.map((c, i) => [c, l[i]])) as unknown as Turma),
    })),
  };
}

// ---------------------------------------------------------------- textos

/** Minúsculas, sem acentos e com espaços simples. */
export function chaveTexto(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const espacos = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();
const digitos = (s: unknown) => String(s ?? '').replace(/\D/g, '');
function numero(v: unknown): number {
  if (typeof v === 'number') return v;
  const n = Number(String(v ?? '').replace(',', '.').trim());
  return Number.isFinite(n) ? n : 0;
}

/** Semelhança entre dois nomes (0 a 1), pelos pares de letras em comum (coeficiente de Dice). */
export function semelhanca(a: string, b: string): number {
  const x = chaveTexto(a).replace(/ /g, '');
  const y = chaveTexto(b).replace(/ /g, '');
  if (!x || !y) return 0;
  if (x === y) return 1;
  const pares = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1);
    return m;
  };
  const px = pares(x);
  const py = pares(y);
  let comum = 0;
  for (const [p, n] of px) comum += Math.min(n, py.get(p) ?? 0);
  return (2 * comum) / (x.length - 1 + (y.length - 1));
}

// ---------------------------------------------------------------- turmas

const TURNOS: Record<string, string> = { '1': 'MANHÃ', '2': 'INTERMEDIÁRIO', '3': 'TARDE', '4': 'NOITE', '5': 'TEMPO INTEGRAL' };
const ETAPAS: Record<string, string> = { B: 'Berçário', M: 'Maternal', J: 'Jardim', C: 'Ciclo', T: 'Totalidade (EJA)', A: 'Ano' };

/**
 * Lê o código da turma do SIGA: letra da etapa, nível, ano, turno e número da turma.
 * Ex.: C41302 → Ciclo IV, 1º ano, TARDE, turma 2. Serve quando a turma não está no panorama (ex.: checklist antiga).
 */
export function decodificarTurma(codigo: string): { etapa: string; turno: string; numero: number } | null {
  const m = /^([A-Z])([A-Z0-9])(\d)(\d)(\d{2})$/.exec(codigo.trim().toUpperCase());
  if (!m) return null;
  return { etapa: ETAPAS[m[1]] ?? m[1], turno: TURNOS[m[4]] ?? '', numero: Number(m[5]) };
}

/** Ordem das etapas (Educação Infantil antes do Fundamental, EJA e Médio no fim). */
function ordemEnsino(ensino: string): number {
  const k = chaveTexto(ensino);
  if (k.includes('infantil')) return 0;
  if (k.startsWith('eja')) return k.includes('medio') ? 4 : 2;
  if (k.includes('fundamental')) return 1;
  if (k.includes('medio')) return 3;
  return 5;
}

/** Ordem de leitura: etapa, depois o código (que já agrupa série, turno e número). */
export function compararTurmas(a: Pick<Turma, 'ensino' | 'turma'>, b: Pick<Turma, 'ensino' | 'turma'>): number {
  return ordemEnsino(a.ensino) - ordemEnsino(b.ensino) || a.turma.localeCompare(b.turma);
}

export interface ResumoTurmas {
  turmas: number;
  alunos: number;
  capacidade: number;
  vagas: number;
  especiais: number;
  /** Turmas com mais alunos que a capacidade. */
  superlotadas: number;
  /** Alunos / capacidade (null sem capacidade informada). */
  ocupacao: number | null;
}

export function resumirTurmas(turmas: Turma[]): ResumoTurmas {
  const s = { turmas: turmas.length, alunos: 0, capacidade: 0, vagas: 0, especiais: 0, superlotadas: 0 };
  for (const t of turmas) {
    s.alunos += t.alunos;
    s.capacidade += t.ocupacao;
    s.vagas += t.vagas;
    s.especiais += t.especial;
    if (t.vagas < 0) s.superlotadas++;
  }
  return { ...s, ocupacao: s.capacidade ? s.alunos / s.capacidade : null };
}

export interface GrupoTurmas {
  ensino: string;
  series: { serie: string; turmas: Turma[] }[];
  resumo: ResumoTurmas;
}

/** Turmas agrupadas por etapa de ensino e série, na ordem de leitura. */
export function agruparTurmas(turmas: Turma[]): GrupoTurmas[] {
  const ordenadas = [...turmas].sort(compararTurmas);
  const grupos: GrupoTurmas[] = [];
  for (const t of ordenadas) {
    let g = grupos.find((x) => x.ensino === t.ensino);
    if (!g) grupos.push((g = { ensino: t.ensino, series: [], resumo: resumirTurmas([]) }));
    let s = g.series.find((x) => x.serie === t.serie);
    if (!s) g.series.push((s = { serie: t.serie, turmas: [] }));
    s.turmas.push(t);
  }
  for (const g of grupos) g.resumo = resumirTurmas(g.series.flatMap((s) => s.turmas));
  return grupos;
}

/** O que mudou nas turmas de uma unidade de um ano para o outro. */
export function compararAnos(atual: Turma[], anterior: Turma[]): { novas: string[]; encerradas: string[]; alunos: number } {
  const a = new Set(atual.map((t) => t.turma));
  const b = new Set(anterior.map((t) => t.turma));
  return {
    novas: [...a].filter((t) => !b.has(t)).sort(),
    encerradas: [...b].filter((t) => !a.has(t)).sort(),
    alunos: resumirTurmas(atual).alunos - resumirTurmas(anterior).alunos,
  };
}

// ---------------------------------------------------------------- leitura da planilha

/** Valor de uma célula do ExcelJS sem os invólucros (texto rico, fórmula, link), mantendo números e datas. */
export function valorCelula(v: unknown): unknown {
  if (v === null || v === undefined || typeof v !== 'object' || v instanceof Date) return v ?? null;
  const o = v as { richText?: { text: string }[]; result?: unknown; text?: unknown; error?: string };
  if (o.richText) return o.richText.map((p) => p.text).join('');
  if (o.error) return null;
  if ('result' in o) return valorCelula(o.result);
  if ('text' in o) return valorCelula(o.text);
  return null;
}

/** Linhas de uma aba do ExcelJS como listas de valores simples (coluna A no índice 0). */
export function linhasDaAba(ws: { rowCount: number; getRow(n: number): { values: unknown } }): unknown[][] {
  const linhas: unknown[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const valores = ws.getRow(r).values as unknown[];
    linhas.push(Array.isArray(valores) ? valores.slice(1).map(valorCelula) : []);
  }
  return linhas;
}

type Campo = keyof Omit<UnidadePanorama, 'turmas' | 'unidade_id'> | keyof Turma | 'ano';

/** Cabeçalhos do relatório do SIGA (e variações já vistas). */
const CABECALHOS: Record<string, Campo> = {
  ano: 'ano',
  distrito: 'distrito',
  zona: 'zona',
  bairro: 'bairro',
  'tipo de contrato': 'tipo_contrato',
  rede: 'rede',
  'cod inep': 'inep',
  'codigo inep': 'inep',
  inep: 'inep',
  'cod unidade': 'codigo',
  'codigo unidade': 'codigo',
  unidade: 'nome',
  ensino: 'ensino',
  serie: 'serie',
  turno: 'turno',
  turma: 'turma',
  'qt ocupacao turma': 'ocupacao',
  'qt alunos turma': 'alunos',
  'qt aluno nao especial': 'nao_especial',
  'qt aluno especial': 'especial',
  'qt ocupacao aluno especial': 'ocupacao_especial',
  'qt vagas restantes': 'vagas',
};

export interface LeituraPanorama {
  panoramas: Panorama[];
  avisos: string[];
}

/**
 * Monta o panorama a partir das linhas da planilha (a primeira linha com os cabeçalhos do SIGA é o cabeçalho).
 * Um arquivo com mais de um ano gera um panorama por ano; sem a coluna Ano, usa `anoPadrao`.
 */
export function lerLinhasPanorama(linhas: unknown[][], fonte: string, anoPadrao?: number): LeituraPanorama {
  const avisos: string[] = [];
  const iCab = linhas.slice(0, 20).findIndex((l) => {
    const campos = new Set(l.map((c) => CABECALHOS[chaveTexto(c)]));
    return campos.has('turma') && campos.has('nome') && (campos.has('inep') || campos.has('codigo'));
  });
  if (iCab < 0) throw new Error('não encontrei os cabeçalhos do Panorama de Matrícula (Unidade, Turma, COD INEP / Cod Unidade).');
  const colunas = new Map<Campo, number>();
  linhas[iCab].forEach((c, i) => {
    const campo = CABECALHOS[chaveTexto(c)];
    if (campo && !colunas.has(campo)) colunas.set(campo, i);
  });
  const pega = (l: unknown[], campo: Campo) => (colunas.has(campo) ? l[colunas.get(campo)!] : undefined);

  const porAno = new Map<number, Map<string, UnidadePanorama>>();
  let ignoradas = 0;
  for (const l of linhas.slice(iCab + 1)) {
    const turma = espacos(pega(l, 'turma')).toUpperCase();
    const nome = espacos(pega(l, 'nome'));
    if (!turma || !nome) {
      if (l.some((c) => espacos(c))) ignoradas++;
      continue;
    }
    const ano = numero(pega(l, 'ano')) || anoPadrao || 0;
    if (!ano) throw new Error('a planilha não tem a coluna Ano; informe o ano.');
    const inep = digitos(pega(l, 'inep'));
    const codigo = espacos(pega(l, 'codigo')) || `INEP-${inep}`;
    let unidades = porAno.get(ano);
    if (!unidades) porAno.set(ano, (unidades = new Map()));
    let u = unidades.get(codigo);
    if (!u) {
      u = {
        codigo,
        inep,
        nome,
        distrito: espacos(pega(l, 'distrito')).toUpperCase(),
        zona: espacos(pega(l, 'zona')).toUpperCase(),
        bairro: espacos(pega(l, 'bairro')).toUpperCase(),
        tipo_contrato: espacos(pega(l, 'tipo_contrato')).toUpperCase(),
        rede: espacos(pega(l, 'rede')).toUpperCase(),
        unidade_id: '',
        turmas: [],
      };
      unidades.set(codigo, u);
    }
    if (u.turmas.some((t) => t.turma === turma)) {
      avisos.push(`${ano}: a turma ${turma} aparece mais de uma vez em ${nome}; ficou a primeira.`);
      continue;
    }
    const ocupacao = numero(pega(l, 'ocupacao'));
    const alunos = numero(pega(l, 'alunos'));
    const especial = numero(pega(l, 'especial'));
    u.turmas.push({
      ensino: espacos(pega(l, 'ensino')).toUpperCase(),
      serie: espacos(pega(l, 'serie')).toUpperCase(),
      turno: espacos(pega(l, 'turno')).toUpperCase() || decodificarTurma(turma)?.turno || '',
      turma,
      ocupacao,
      alunos,
      nao_especial: colunas.has('nao_especial') ? numero(pega(l, 'nao_especial')) : alunos - especial,
      especial,
      ocupacao_especial: colunas.has('ocupacao_especial') ? numero(pega(l, 'ocupacao_especial')) : especial,
      vagas: colunas.has('vagas') ? numero(pega(l, 'vagas')) : ocupacao - alunos,
    });
  }
  if (ignoradas) avisos.push(`${ignoradas} linha(s) sem unidade ou turma foram ignoradas.`);
  if (!porAno.size) throw new Error('a planilha não tem nenhuma turma.');
  const panoramas = [...porAno]
    .sort(([a], [b]) => b - a)
    .map(([ano, unidades]) => ({
      ano,
      fonte,
      unidades: [...unidades.values()].map((u) => ({ ...u, turmas: u.turmas.sort(compararTurmas) })),
    }));
  return { panoramas, avisos };
}

// ---------------------------------------------------------------- unidades do cadastro

/** Nome com semelhança mínima para ligar uma unidade sem INEP correspondente no cadastro. */
const SEMELHANCA_MINIMA = 0.85;

/**
 * Liga cada unidade do panorama à do Cadastro: primeiro pela ligação de um ano anterior (o código da SEMEC não muda),
 * depois pelo INEP (o anexo divide o INEP com a sede, então o nome desempata) e, por fim, só pelo nome.
 * Uma unidade do cadastro nunca recebe duas do panorama: fica a de nome mais parecido.
 */
export function associarUnidades(p: Panorama, cadastro: Pick<Unidade, 'id' | 'inep' | 'nome'>[], anteriores: Map<string, string> = new Map()): Panorama {
  const existe = new Set(cadastro.map((u) => u.id));
  const porInep = new Map<string, Pick<Unidade, 'id' | 'inep' | 'nome'>[]>();
  for (const u of cadastro) {
    const k = digitos(u.inep);
    if (k) porInep.set(k, [...(porInep.get(k) ?? []), u]);
  }
  const escolhas = p.unidades.map((u) => {
    const antes = anteriores.get(u.codigo);
    if (antes && existe.has(antes)) return { id: antes, nota: 2 };
    const candidatos = porInep.get(u.inep) ?? [];
    const lista = candidatos.length ? candidatos : cadastro;
    let melhor = { id: '', nota: 0 };
    for (const c of lista) {
      const nota = semelhanca(c.nome, u.nome) + (candidatos.length === 1 ? 1 : 0);
      if (nota > melhor.nota) melhor = { id: c.id, nota };
    }
    if (!candidatos.length && melhor.nota < SEMELHANCA_MINIMA) return { id: '', nota: 0 };
    return melhor;
  });
  const dono = new Map<string, number>();
  escolhas.forEach((e, i) => {
    if (!e.id) return;
    const j = dono.get(e.id);
    if (j === undefined || escolhas[j].nota < e.nota) dono.set(e.id, i);
  });
  return { ...p, unidades: p.unidades.map((u, i) => ({ ...u, unidade_id: dono.get(escolhas[i].id) === i ? escolhas[i].id : '' })) };
}

/** Resumo de um panorama para listas (sem as turmas). */
export function contarPanorama(p: Panorama): { unidades: number; associadas: number; turmas: number; alunos: number } {
  let turmas = 0;
  let alunos = 0;
  for (const u of p.unidades) {
    turmas += u.turmas.length;
    for (const t of u.turmas) alunos += t.alunos;
  }
  return { unidades: p.unidades.length, associadas: p.unidades.filter((u) => u.unidade_id).length, turmas, alunos };
}
