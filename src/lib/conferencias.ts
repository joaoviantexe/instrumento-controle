import { CATEGORIAS_PDF_CME, CATEGORIAS_PDF_DIARIO } from './anexos';
import { RESOLUCOES_CME, tituloResolucao, type ResolucaoCme } from './cme';
import { ATOS_DIARIO, PAINEL_DIARIO as PAINEL_DIARIO_URL, linkDiario, referenciaDiario, tituloAto, type AtoDiario, type Confianca } from './diario';
import type { Anexo, Unidade } from './types';

/** De onde vem o ato: resoluções do CME ou Diário Oficial do Município. */
export type FonteAto = 'cme' | 'diario';
export type Decisao = 'confirmado' | 'recusado';

/** Decisão de quem conferiu uma associação ato → unidade. */
export interface Conferencia {
  fonte: FonteAto;
  ato_id: string;
  unidade_id: string;
  decisao: Decisao;
  nota: string;
  conferido_por: string;
  conferido_em: string;
}

export type ChaveConferencia = Pick<Conferencia, 'fonte' | 'ato_id' | 'unidade_id'>;
export type MapaConferencias = ReadonlyMap<string, Conferencia>;

export const chaveDe = (c: ChaveConferencia) => `${c.fonte}|${c.ato_id}|${c.unidade_id}`;
export const indexarConferencias = (l: Conferencia[]): MapaConferencias => new Map(l.map((c) => [chaveDe(c), c]));

/** Como a associação aparece na página da unidade: a do arquivo de dados ou "confirmado" pela conferência. */
export type SituacaoVinculo = Confianca | 'confirmado';

/** Classe do chip de cada situação na página da unidade. */
export const CLASSE_SITUACAO_VINCULO: Record<SituacaoVinculo, string> = {
  alta: '',
  confirmado: 'chip--verde',
  media: 'chip--parcial',
  baixa: 'chip--nc',
};

/** Situação da associação depois da conferência; "recusado" é o que não deve mais aparecer. */
export function situacaoDoVinculo(
  mapa: MapaConferencias | undefined,
  fonte: FonteAto,
  atoId: string,
  unidadeId: string,
  original: Confianca,
): SituacaoVinculo | 'recusado' {
  const d = mapa?.get(chaveDe({ fonte, ato_id: atoId, unidade_id: unidadeId }))?.decisao;
  return d === 'recusado' ? 'recusado' : d === 'confirmado' ? 'confirmado' : original;
}

/** Uma associação para o administrador conferir. */
export interface ItemConferencia {
  chave: string;
  fonte: FonteAto;
  ato_id: string;
  unidade_id: string;
  titulo: string;
  descricao: string;
  relacao: string;
  /** Confiança do arquivo de dados (antes da conferência). */
  confianca: Confianca;
  nota: string;
  /** Onde o ato foi publicado. */
  referencia: string;
  /** Link que abre o PDF (do CME ou do Diário na página do ato); nulo quando não há. */
  url: string | null;
  conferencia?: Conferencia;
}

/**
 * Associações que pedem conferência: as prováveis ou a conferir do arquivo de dados e as que já têm decisão (para poder
 * desfazê-la). As confirmadas no texto do ato ("alta") só entram se alguém já decidiu sobre elas.
 */
export function itensCme(resolucoes: ResolucaoCme[] = RESOLUCOES_CME, mapa?: MapaConferencias): ItemConferencia[] {
  return resolucoes.flatMap((r) =>
    r.unidades.flatMap((v) => {
      const chave = chaveDe({ fonte: 'cme', ato_id: r.id, unidade_id: v.id });
      const conferencia = mapa?.get(chave);
      if (v.confianca === 'alta' && !conferencia) return [];
      return [
        {
          chave,
          fonte: 'cme' as const,
          ato_id: r.id,
          unidade_id: v.id,
          titulo: tituloResolucao(r),
          descricao: r.descricao,
          relacao: v.relacao,
          confianca: v.confianca,
          nota: v.nota ?? '',
          referencia: 'Site do CME',
          url: r.url,
          conferencia,
        },
      ];
    }),
  );
}

export function itensDiario(atos: AtoDiario[] = ATOS_DIARIO, mapa?: MapaConferencias): ItemConferencia[] {
  return atos.flatMap((a) =>
    a.unidades.flatMap((v) => {
      const chave = chaveDe({ fonte: 'diario', ato_id: a.id, unidade_id: v.id });
      const conferencia = mapa?.get(chave);
      if (v.confianca === 'alta' && !conferencia) return [];
      return [
        {
          chave,
          fonte: 'diario' as const,
          ato_id: a.id,
          unidade_id: v.id,
          titulo: tituloAto(a),
          descricao: a.ementa,
          relacao: v.relacao,
          confianca: v.confianca,
          nota: [v.nota, a.nota].filter(Boolean).join(' · '),
          referencia: a.publicacao ? referenciaDiario(a.publicacao) : a.referencia ?? '',
          url: linkDiario(a.publicacao),
          conferencia,
        },
      ];
    }),
  );
}

/** Unidades sem nenhuma resolução do CME (as recusadas na conferência não contam). */
export function unidadesSemResolucao<U extends Pick<Unidade, 'id'>>(unidades: U[], resolucoes: ResolucaoCme[] = RESOLUCOES_CME, mapa?: MapaConferencias): U[] {
  const com = new Set(
    resolucoes.flatMap((r) => r.unidades.filter((v) => situacaoDoVinculo(mapa, 'cme', r.id, v.id, v.confianca) !== 'recusado').map((v) => v.id)),
  );
  return unidades.filter((u) => !com.has(u.id));
}

/** Atos do Diário sem link para a edição: ainda sem número de edição ou que não saíram numa edição (texto do portal de leis). */
export function atosDiarioSemLink(atos: AtoDiario[] = ATOS_DIARIO): { ato: AtoDiario; motivo: string }[] {
  return atos
    .filter((a) => !a.publicacao?.edicao)
    .map((ato) => ({
      ato,
      motivo: ato.publicacao ? 'Falta o número da edição do Diário.' : ato.referencia || 'Sem edição do Diário identificada.',
    }));
}

/** Uma associação já confirmada no texto do ato ou pela conferência: serve de prova, ao contrário das "prováveis". */
const segura = (situacao: SituacaoVinculo | 'recusado') => situacao === 'alta' || situacao === 'confirmado';

/** Unidades com ao menos uma resolução do CME associada (as recusadas na conferência não contam). */
export function unidadesComResolucaoCme(resolucoes: ResolucaoCme[] = RESOLUCOES_CME, mapa?: MapaConferencias): Set<string> {
  return new Set(
    resolucoes.flatMap((r) => r.unidades.filter((v) => situacaoDoVinculo(mapa, 'cme', r.id, v.id, v.confianca) !== 'recusado').map((v) => v.id)),
  );
}

/** Relações do Diário que são o ato de criação, instituição ou nome da unidade (o que um PDF de "Decreto" ou "Ato de criação" costuma ser). */
const relacaoDeCriacao = (relacao: string) =>
  relacao.startsWith('criação') || ['instituição', 'transformação', 'denominação', 'alteração de nome', 'retificação'].includes(relacao);

/** Um PDF enviado à mão que o site já tem como link, e os atos que o substituem. */
export interface AnexoRedundante {
  anexo: Anexo;
  /** De onde vem o link que o substitui. */
  fonte: FonteAto;
  equivalentes: { titulo: string; referencia: string; url: string }[];
}

/**
 * PDFs enviados à mão (Decreto, Ato de criação, Ato de autorização e resoluções do CME) cuja unidade já tem o ato como link do
 * CME ou do Diário. Só conta o link seguro (confirmado no texto ou pela conferência) e, no Diário, com número de edição: um link
 * "provável" ou sem edição não substitui o PDF. A decisão final de apagar é de quem confere: o nome do arquivo não prova que
 * é o mesmo ato.
 */
export function anexosRedundantes(
  anexos: Anexo[],
  resolucoes: ResolucaoCme[] = RESOLUCOES_CME,
  atos: AtoDiario[] = ATOS_DIARIO,
  mapa?: MapaConferencias,
): AnexoRedundante[] {
  const cmePorUnidade = new Map<string, AnexoRedundante['equivalentes']>();
  for (const r of resolucoes)
    for (const v of r.unidades)
      if (segura(situacaoDoVinculo(mapa, 'cme', r.id, v.id, v.confianca)))
        cmePorUnidade.set(v.id, [...(cmePorUnidade.get(v.id) ?? []), { titulo: tituloResolucao(r), referencia: `Site do CME · ${v.relacao}`, url: r.url }]);
  const diarioPorUnidade = new Map<string, AnexoRedundante['equivalentes']>();
  for (const a of atos) {
    const link = linkDiario(a.publicacao);
    if (!a.publicacao?.edicao) continue;
    for (const v of a.unidades)
      if (relacaoDeCriacao(v.relacao) && segura(situacaoDoVinculo(mapa, 'diario', a.id, v.id, v.confianca)))
        diarioPorUnidade.set(v.id, [...(diarioPorUnidade.get(v.id) ?? []), { titulo: tituloAto(a), referencia: `${referenciaDiario(a.publicacao)} · ${v.relacao}`, url: link ?? PAINEL_DIARIO_URL }]);
  }
  const saida: AnexoRedundante[] = [];
  for (const anexo of anexos) {
    if (anexo.entidade !== 'unidade') continue;
    const cme = CATEGORIAS_PDF_CME.includes(anexo.categoria) ? cmePorUnidade.get(anexo.entidade_id) : undefined;
    const diario = CATEGORIAS_PDF_DIARIO.includes(anexo.categoria) ? diarioPorUnidade.get(anexo.entidade_id) : undefined;
    if (cme?.length) saida.push({ anexo, fonte: 'cme', equivalentes: cme });
    else if (diario?.length) saida.push({ anexo, fonte: 'diario', equivalentes: diario });
  }
  return saida;
}
