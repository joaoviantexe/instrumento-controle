import dados from '../data/atos-diario.json';
import { formatarData } from './format';

/** Onde o ato foi publicado no Diário Oficial do Município de Belém (DOM). */
export interface PublicacaoDiario {
  /** Número da edição, que é também o número usado pelo painel do Diário. Nulo quando ainda não identificado. */
  edicao: number | null;
  data: string;
  /** Página impressa no cabeçalho da edição. */
  pagina: number;
  /** Quando o ato continua em outra página. */
  pagina_final?: number;
}

export type Confianca = 'alta' | 'media' | 'baixa';

export interface VinculoUnidade {
  id: string;
  inep: string;
  /** Papel do ato para a unidade: criação, instituição, extinção da antecessora, retificação… */
  relacao: string;
  confianca: Confianca;
  nota?: string;
}

export interface AtoDiario {
  id: string;
  tipo: string;
  numero: string;
  data: string | null;
  ementa: string;
  /** Nulo quando o ato não veio de uma página do Diário (ex.: texto do portal de legislação). */
  publicacao: PublicacaoDiario | null;
  /** De onde veio o ato quando não há página do Diário. */
  referencia?: string;
  nota?: string;
  /** PDFs de origem (pasta dados/atos-de-criacao), só para conferência: o site usa o link do Diário. */
  arquivos: string[];
  unidades: VinculoUnidade[];
}

export const ATOS_DIARIO = (dados as unknown as { atos: AtoDiario[] }).atos;

/** Painel público do Diário Oficial (busca por data ou número da edição). */
export const PAINEL_DIARIO = 'https://sistemas.belem.pa.gov.br/diario/painel';

const env = import.meta.env as unknown as Record<string, string | undefined>;
/** Worker que entrega as edições do Diário: o dos anexos, salvo se VITE_DIARIO_URL indicar outro. */
export const DIARIO_URL = (env.VITE_DIARIO_URL || env.VITE_ANEXOS_URL || '').replace(/\/+$/, '');

/** Link que abre a edição já na página do ato, ou null quando não há edição identificada ou Worker configurado. */
export function linkDiario(p: PublicacaoDiario | null, base = DIARIO_URL): string | null {
  if (!p?.edicao || !base) return null;
  return `${base}/diario/${p.edicao}.pdf?pagina=${p.pagina}#page=${p.pagina}`;
}

const milhar = (n: number) => n.toLocaleString('pt-BR');

/** "DOM nº 15.011, de 16/08/2024, p. 2–3" */
export function referenciaDiario(p: PublicacaoDiario): string {
  const paginas = p.pagina_final ? `p. ${p.pagina}–${p.pagina_final}` : `p. ${p.pagina}`;
  const edicao = p.edicao ? `DOM nº ${milhar(p.edicao)}` : 'DOM (edição a identificar)';
  return `${edicao}, de ${formatarData(p.data)}, ${paginas}`;
}

/** "Decreto nº 111.991/2024-PMB, de 13/08/2024" */
export function tituloAto(a: AtoDiario): string {
  return `${a.tipo} nº ${a.numero}${a.data ? `, de ${formatarData(a.data)}` : ''}`;
}

/** Atos ligados a uma unidade, do mais antigo para o mais recente. */
export function atosDaUnidade(unidadeId: string, atos: AtoDiario[] = ATOS_DIARIO): { ato: AtoDiario; vinculo: VinculoUnidade }[] {
  return atos
    .flatMap((ato) => ato.unidades.filter((v) => v.id === unidadeId).map((vinculo) => ({ ato, vinculo })))
    .sort((a, b) => (a.ato.data || a.ato.publicacao?.data || '').localeCompare(b.ato.data || b.ato.publicacao?.data || ''));
}

export const ROTULO_CONFIANCA: Record<Confianca, string> = {
  alta: 'Confirmada no texto do ato',
  media: 'Provável — confira',
  baixa: 'A conferir',
};
