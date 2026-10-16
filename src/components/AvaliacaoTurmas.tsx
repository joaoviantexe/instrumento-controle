import { Check } from 'lucide-react';
import { SITUACOES_ITEM } from '../data/planilha';
import { avaliado } from '../lib/calc';
import { VERIFICACAO_FEITA, VERIFICACAO_PENDENTE, avaliacaoTurmaPadrao, avaliadoPelaCde, divergeDaDeclaracao } from '../lib/checklist';
import { avisar } from '../lib/avisos';
import type { Turma } from '../lib/panorama';
import { useDados } from '../lib/store';
import type { Avaliacao, AvaliacaoTurma, SituacaoItem } from '../lib/types';
import { Etiqueta } from './ui';

const CLASSE: Record<string, string> = {
  Conforme: 'conforme',
  'Parcialmente conforme': 'parcial',
  'Não conforme': 'nc',
  'Não se aplica': 'na',
  'Não avaliado': 'nav',
};

/** Escolha da situação num seletor compacto, com a cor da situação. */
export function SeletorSituacao({ valor, aoMudar, rotulo }: { valor: string; aoMudar: (s: SituacaoItem) => void; rotulo: string }) {
  return (
    <select className={`sel-situacao sel-situacao--${CLASSE[valor] ?? 'nav'}`} aria-label={rotulo} value={valor} onChange={(e) => aoMudar(e.target.value as SituacaoItem)}>
      {SITUACOES_ITEM.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

/** Escolher a situação de algo autodeclarado é a verificação da CDE. */
export const comVerificacao = <T extends { verificacao?: string }>(r: T, situacao: SituacaoItem): T & { situacao: SituacaoItem } => ({
  ...r,
  situacao,
  verificacao: r.verificacao === VERIFICACAO_PENDENTE ? VERIFICACAO_FEITA : r.verificacao,
});

const TURNO_CURTO: Record<string, string> = { MANHÃ: 'manhã', TARDE: 'tarde', NOITE: 'noite', 'TEMPO INTEGRAL': 'integral', INTERMEDIÁRIO: 'intermed.' };

/**
 * Avaliação de um item turma a turma. A situação do item na auditoria é recalculada a partir das turmas
 * (as turmas sem avaliação contam como não avaliadas).
 */
export function GradeTurmas({ auditoriaId, item, turmas, atual }: { auditoriaId: string; item: string; turmas: Turma[]; atual: Avaliacao }) {
  const d = useDados();
  const registros = d.mapaTurmas.get(auditoriaId)?.get(item);
  const codigos = turmas.map((t) => t.turma);
  const reg = (t: string) => registros?.get(t) ?? avaliacaoTurmaPadrao(auditoriaId, item, t);
  const salvar = (lista: AvaliacaoTurma[]) => void d.salvarAvaliacoesTurma(lista, codigos).catch(() => undefined);

  const pendentes = codigos.filter((t) => reg(t).verificacao === VERIFICACAO_PENDENTE);
  const avaliadas = codigos.filter((t) => avaliado(reg(t).situacao)).length;

  function todas(s: SituacaoItem) {
    salvar(codigos.map((t) => comVerificacao(reg(t), s)));
    avisar(`${item}: ${s} em ${codigos.length} turma(s).`);
  }

  return (
    <div className="grade-turmas">
      <div className="grade-turmas__barra">
        <span className="pequeno">
          <strong>
            {avaliadas}/{codigos.length}
          </strong>{' '}
          turmas avaliadas
        </span>
        <label className="seletor-ano">
          <span>Todas as turmas:</span>
          <select value="" onChange={(e) => e.target.value && todas(e.target.value as SituacaoItem)} aria-label={`${item}: mesma situação em todas as turmas`}>
            <option value="">escolher…</option>
            {SITUACOES_ITEM.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        {pendentes.length > 0 && (
          <button type="button" className="btn btn--verde btn--pequeno" onClick={() => salvar(pendentes.map((t) => ({ ...reg(t), verificacao: VERIFICACAO_FEITA })))}>
            <Check size={14} aria-hidden /> Confirmar {pendentes.length} autodeclarada(s)
          </button>
        )}
      </div>
      {!registros?.size && avaliadoPelaCde(atual) && (
        <p className="pequeno texto-muted" style={{ margin: 0 }}>
          Avaliado antes para a unidade inteira: <Etiqueta valor={atual.situacao} />. Ao avaliar as turmas, a situação do item passa a ser a delas.
        </p>
      )}
      <ul className="grade-turmas__lista">
        {turmas.map((t) => {
          const r = reg(t.turma);
          const pendente = r.verificacao === VERIFICACAO_PENDENTE;
          const diverge = divergeDaDeclaracao(r);
          return (
            <li key={t.turma} className={'grade-turmas__turma' + (pendente ? ' grade-turmas__turma--pendente' : diverge ? ' grade-turmas__turma--diverge' : '')}>
              <span className="grade-turmas__cab">
                <strong title={[t.serie, t.turno].filter(Boolean).join(' · ')}>{t.turma}</strong>
                <span className="grade-turmas__serie">{[t.serie, TURNO_CURTO[t.turno] ?? t.turno.toLowerCase()].filter(Boolean).join(' · ')}</span>
              </span>
              <SeletorSituacao valor={r.situacao} aoMudar={(s) => salvar([comVerificacao(r, s)])} rotulo={`${item} — turma ${t.turma}`} />
              {pendente && (
                <button
                  type="button"
                  className="grade-turmas__confirmar"
                  title={`Autodeclarado pela secretaria (${r.declarado}). Confirmar depois de conferir.`}
                  onClick={() => salvar([{ ...r, verificacao: VERIFICACAO_FEITA }])}
                >
                  <Check size={12} aria-hidden /> confirmar
                </button>
              )}
              {diverge && <span className="grade-turmas__nota">secretaria: {r.declarado}</span>}
              {r.verificacao === VERIFICACAO_FEITA && !diverge && <span className="grade-turmas__nota grade-turmas__nota--ok">verificado</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
