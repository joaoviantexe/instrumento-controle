import { RESOLUCOES_CME, tituloResolucao, type ResolucaoCme } from './cme';
import { ATOS_DIARIO, linkDiario, referenciaDiario, tituloAto, type AtoDiario, type Confianca } from './diario';
import type { Unidade } from './types';

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
