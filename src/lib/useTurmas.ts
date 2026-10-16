import { useEffect, useState } from 'react';
import { decodificarTurma, compararTurmas, type Turma } from './panorama';
import { useDados } from './store';
import type { Auditoria } from './types';

/** Ano do panorama para uma auditoria: o da data dela (realizada ou planejada), ou o mais recente disponível até ele. */
export function anoDaAuditoria(aud: Pick<Auditoria, 'data_realizada' | 'data_planejada'> | undefined, anos: number[], hoje = new Date()): number {
  const pela = Number((aud?.data_realizada || aud?.data_planejada || '').slice(0, 4)) || hoje.getFullYear();
  if (anos.includes(pela)) return pela;
  return [...anos].sort((a, b) => b - a).find((a) => a <= pela) ?? anos[0] ?? pela;
}

/** Turma mínima para um código que não está no panorama (ex.: turma avaliada que deixou de existir). */
function turmaSoCodigo(codigo: string): Turma {
  const d = decodificarTurma(codigo);
  return { ensino: '', serie: d?.etapa ?? '', turno: d?.turno ?? '', turma: codigo, ocupacao: 0, alunos: 0, nao_especial: 0, especial: 0, ocupacao_especial: 0, vagas: 0 };
}

/**
 * Turmas de uma auditoria: as da unidade no Panorama de Matrícula do ano da auditoria, mais as que já têm avaliação
 * registrada e não estão no panorama.
 */
export function useTurmasDaAuditoria(aud: Auditoria | undefined): { carregando: boolean; turmas: Turma[]; ano: number } {
  const d = useDados();
  const anos = d.panoramas.map((p) => p.ano);
  const ano = anoDaAuditoria(aud, anos);
  const [estado, setEstado] = useState<{ chave: string; turmas: Turma[] } | null>(null);
  const chave = `${aud?.unidade_id ?? ''}|${ano}`;

  useEffect(() => {
    if (!aud) return;
    let vivo = true;
    void d
      .obterPanorama(ano)
      .then((p) => vivo && setEstado({ chave, turmas: p?.unidades.find((u) => u.unidade_id === aud.unidade_id)?.turmas ?? [] }))
      .catch(() => vivo && setEstado({ chave, turmas: [] }));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, d.obterPanorama]);

  const doPanorama = estado?.chave === chave ? estado.turmas : [];
  const registradas = [...(d.mapaTurmas.get(aud?.id ?? '')?.values() ?? [])].flatMap((m) => [...m.keys()]);
  const extras = [...new Set(registradas)].filter((c) => !doPanorama.some((t) => t.turma === c)).map(turmaSoCodigo);
  return { carregando: !!aud && estado?.chave !== chave, turmas: [...doPanorama, ...extras].sort(compararTurmas), ano };
}
