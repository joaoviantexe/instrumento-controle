import { AUDITORIAS_INICIAIS, UNIDADES_INICIAIS } from '../../data/planilha';
import type { Snapshot } from '../types';

/** Dados iniciais: o conteúdo da planilha original. */
export function snapshotInicial(): Snapshot {
  return {
    unidades: structuredClone(UNIDADES_INICIAIS),
    auditorias: structuredClone(AUDITORIAS_INICIAIS),
    avaliacoes: [],
    acoes: [],
  };
}
