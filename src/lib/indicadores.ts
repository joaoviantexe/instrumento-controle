import { useMemo } from 'react';
import { LISTA_MESTRA } from '../data/planilha';
import { contarSituacoes, indiceGlobal, linhasRegistradas, type Linha } from './calc';
import { useDados } from './store';
import type { Acao, Auditoria, Unidade } from './types';

export interface Recorte {
  unidades: Unidade[];
  auditorias: Auditoria[];
  acoes: Acao[];
  linhas: Linha[];
}

/** Dados filtrados por distrito (vazio = todos). */
export function useRecorte(distrito: string): Recorte {
  const d = useDados();
  return useMemo(() => {
    if (!distrito) return { unidades: d.unidades, auditorias: d.auditorias, acoes: d.acoes, linhas: d.linhas };
    const unidades = d.unidades.filter((u) => u.distrito === distrito);
    const ids = new Set(unidades.map((u) => u.id));
    const auditorias = d.auditorias.filter((a) => ids.has(a.unidade_id));
    return {
      unidades,
      auditorias,
      acoes: d.acoes.filter((a) => ids.has(a.unidade_id)),
      linhas: linhasRegistradas(auditorias, d.mapaAvaliacoes),
    };
  }, [d, distrito]);
}

/** Os seis indicadores do Dashboard (A5:R9). */
export function calcularKpis(r: Recorte) {
  const contagem = contarSituacoes(r.linhas);
  return {
    unidades: r.unidades.length,
    itens: LISTA_MESTRA.length,
    auditorias: r.auditorias.length,
    avaliados: r.linhas.length - contagem['Não avaliado'],
    naoConformes: contagem['Não conforme'],
    indice: indiceGlobal(r.linhas),
    contagem,
  };
}
