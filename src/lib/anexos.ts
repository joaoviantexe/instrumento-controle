import { CABECALHOS_UNIDADE as C } from '../data/planilha';
import type { Anexo, EntidadeAnexo } from './types';

/** Tamanho máximo de cada PDF (o plano gratuito do Supabase aceita até 50 MB por arquivo). */
export const LIMITE_BYTES = 10 * 1024 * 1024;

/** Categorias de documento de cada tipo de registro (os nomes vêm das colunas da planilha). */
export const CATEGORIAS: Record<EntidadeAnexo, string[]> = {
  unidade: [C.ato_autorizacao, C.ato_criacao, 'Outro documento'],
  auditoria: ['Relatório da auditoria', 'Comprovante da visita', 'Outro documento'],
  avaliacao: ['Evidência'],
  acao: ['Evidência de conclusão'],
};
/** O PDF do ato de autorização é o documento que comprova a vigência. */
export const CATEGORIA_ATO = C.ato_autorizacao;

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
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
  return new Set(anexos.filter((a) => a.entidade === 'unidade' && a.categoria === CATEGORIA_ATO).map((a) => a.entidade_id));
}
