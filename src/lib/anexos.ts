import { CABECALHOS_UNIDADE as C } from '../data/planilha';
import type { Anexo, EntidadeAnexo } from './types';

/** Tamanho máximo de cada PDF (o plano gratuito do Supabase aceita até 50 MB por arquivo). */
export const LIMITE_BYTES = 10 * 1024 * 1024;

/** Categorias de documento de cada tipo de registro (os nomes vêm das colunas da planilha). */
export const CATEGORIA_AUTORIZACAO_CME = 'Autorização de Funcionamento - CME';

const OUTRO = 'Outro documento';

/** Ordem alfabética, com "Outro documento" sempre por último. */
const emOrdem = (l: string[]) =>
  [...l].sort((a, b) => (a === OUTRO ? 1 : b === OUTRO ? -1 : a.localeCompare(b, 'pt-BR')));

/** Em ordem alfabética. */
export const CATEGORIAS: Record<EntidadeAnexo, string[]> = {
  unidade: emOrdem([CATEGORIA_AUTORIZACAO_CME, C.ato_autorizacao, C.ato_criacao, 'Decreto', OUTRO]),
  auditoria: emOrdem(['Relatório da auditoria', 'Comprovante da visita', OUTRO]),
  avaliacao: ['Evidência'],
  acao: ['Evidência de conclusão'],
};
/** O PDF do ato de autorização é o documento que comprova a vigência. */
export const CATEGORIA_ATO = C.ato_autorizacao;

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2).replace('.', ',')} GB`;
}

/**
 * Confere se o arquivo é um PDF válido para anexar. Devolve a mensagem de erro, ou null se estiver ok.
 * Além da extensão, verifica o conteúdo: todo PDF começa com "%PDF-".
 */
export async function validarPdf(arquivo: File): Promise<string | null> {
  if (arquivo.size === 0) return `"${arquivo.name}" está vazio.`;
  if (arquivo.size > LIMITE_BYTES) return `"${arquivo.name}" tem ${formatarTamanho(arquivo.size)}; o limite é ${formatarTamanho(LIMITE_BYTES)}.`;
  const pareceNome = /\.pdf$/i.test(arquivo.name);
  const pareceTipo = arquivo.type === 'application/pdf';
  if (!pareceNome && !pareceTipo) return `"${arquivo.name}" não é um PDF. Anexe apenas arquivos .pdf.`;
  const inicio = await arquivo.slice(0, 5).text();
  if (inicio !== '%PDF-') return `"${arquivo.name}" não é um PDF válido (o conteúdo não corresponde ao formato).`;
  return null;
}

/** Ids das unidades que já têm o PDF do ato de autorização anexado. */
export function unidadesComAto(anexos: Anexo[]): Set<string> {
  return new Set(
    anexos
      .filter((a) => a.entidade === 'unidade' && (a.categoria === CATEGORIA_ATO || a.categoria === CATEGORIA_AUTORIZACAO_CME))
      .map((a) => a.entidade_id),
  );
}

/** Impressão digital (SHA-256, em hexadecimal) do conteúdo: arquivos idênticos têm o mesmo valor. */
export async function hashArquivo(arquivo: Blob): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', await arquivo.arrayBuffer()));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Nome do arquivo no armazenamento: pelo conteúdo (hash) ou, nos anexos antigos, pelo id. */
export const chaveArquivo = (a: Pick<Anexo, 'id' | 'hash'>) => a.hash || a.id;

export interface ResumoAnexos {
  anexos: number;
  /** Arquivos realmente guardados (anexos idênticos contam uma vez). */
  arquivos: number;
  /** Espaço ocupado hoje. */
  bytesUsados: number;
  /** Espaço que uma unificação ainda pode liberar (cópias idênticas ou antigas sem hash). */
  pendentes: number;
  /** Quanto o compartilhamento de arquivos idênticos já economiza. */
  bytesEconomizados: number;
}

export function resumirAnexos(anexos: Anexo[]): ResumoAnexos {
  const porChave = new Map<string, number>();
  let total = 0;
  let semHash = 0;
  for (const a of anexos) {
    total += a.tamanho;
    if (!a.hash) semHash++;
    if (!porChave.has(chaveArquivo(a))) porChave.set(chaveArquivo(a), a.tamanho);
  }
  const usados = [...porChave.values()].reduce((s, t) => s + t, 0);
  return { anexos: anexos.length, arquivos: porChave.size, bytesUsados: usados, pendentes: semHash, bytesEconomizados: total - usados };
}

/** Limite de armazenamento dos anexos, em GB: padrão 1 GB (plano gratuito do Supabase). Ajustável por VITE_LIMITE_ARMAZENAMENTO_GB. */
export function limiteArmazenamentoBytes(): number {
  const bruto = Number((import.meta.env as unknown as Record<string, string | undefined>).VITE_LIMITE_ARMAZENAMENTO_GB);
  return (Number.isFinite(bruto) && bruto > 0 ? bruto : 1) * 1024 * 1024 * 1024;
}
