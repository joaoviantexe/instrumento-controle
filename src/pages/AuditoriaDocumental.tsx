import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ClipboardList, Pencil, Printer } from 'lucide-react';
import { Etiqueta, Faixa, Medidor, Nota } from '../components/ui';
import { Combobox } from '../components/Combobox';
import { FormAuditoria } from '../components/FormAuditoria';
import { PainelAuditoria } from '../components/PainelAuditoria';
import { ROTULOS_AUDITORIA_DOC as R, ROTULOS_PLANO, TEXTOS } from '../data/planilha';
import { useDados } from '../lib/store';
import { avisar } from '../lib/avisos';
import type { Auditoria } from '../lib/types';

function SeletorAuditoria({ atual }: { atual?: string }) {
  const d = useDados();
  const navegar = useNavigate();
  const opcoes = useMemo(
    () =>
      d.auditorias.map((a) => {
        const u = d.unidadePorId.get(a.unidade_id);
        return {
          valor: a.id,
          rotulo: `${a.id} — ${u?.nome ?? ''}`,
          detalhe: [u?.distrito, u?.bairro, a.situacao, a.tipo].filter(Boolean).join(' · '),
        };
      }),
    [d.auditorias, d.unidadePorId],
  );
  return (
    <Combobox
      rotulo={`${R.id} / ${R.unidade}`}
      opcoes={opcoes}
      valor={atual ?? ''}
      aoMudar={(v) => v && navegar(`/auditoria-documental/${v}`)}
      obrigatorio
    />
  );
}

export function AuditoriaDocumental() {
  const { id } = useParams();
  const d = useDados();
  const aud = id ? d.auditoriaPorId.get(id) : undefined;
  const t = TEXTOS.auditoriaDocumental;
  const passo = TEXTOS.instrucoes.passos[2];

  if (!aud) {
    const recentes = d.auditorias
      .filter((a) => a.iniciada || a.situacao === 'Em execução' || a.situacao === 'Agendada')
      .slice(0, 12);
    return (
      <>
        <Faixa titulo={t.titulo} sub={t.subtitulo} />
        <div className="container pagina">
          <Nota>
            <strong>{passo.titulo}.</strong> {passo.descricao}
          </Nota>
          <section className="cartao">
            <div className="cartao__corpo" style={{ display: 'grid', gap: 16 }}>
              <SeletorAuditoria />
              {id && <Nota tipo="alerta">{`${R.id} ${id} não encontrado.`}</Nota>}
            </div>
            {recentes.length > 0 && (
              <ul className="lista-simples" style={{ borderTop: '1px solid var(--borda)' }}>
                {recentes.map((a) => {
                  const s = d.resumos.get(a.id);
                  return (
                    <li key={a.id}>
                      <div>
                        <Link to={`/auditoria-documental/${a.id}`}>
                          {a.id} · {d.unidadePorId.get(a.unidade_id)?.nome}
                        </Link>
                        <div className="pequeno texto-muted">
                          {ROTULOS_PLANO.avaliados}: {s?.avaliados ?? 0}/{s?.previstos ?? 0}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <Etiqueta valor={a.situacao} />
                        <Medidor valor={s?.indice ?? null} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </>
    );
  }

  return <PaginaAuditoria aud={aud} />;
}

function PaginaAuditoria({ aud }: { aud: Auditoria }) {
  const d = useDados();
  const [editando, setEditando] = useState(false);
  const u = d.unidadePorId.get(aud.unidade_id);
  return (
    <>
      <Faixa bruto sobre={`Auditoria Documental · ${aud.id}`} titulo={u?.nome ?? aud.id} sub={TEXTOS.auditoriaDocumental.subtitulo}>
        <Link to={`/checklist-da-visita/${aud.id}`} className="btn btn--claro">
          <ClipboardList size={16} aria-hidden /> Checklist da Visita
        </Link>
        <button type="button" className="btn btn--claro" onClick={() => setEditando(true)}>
          <Pencil size={16} aria-hidden /> Plano de Visita Técnica
        </button>
        <button type="button" className="btn btn--claro" onClick={() => window.print()}>
          <Printer size={16} aria-hidden /> Imprimir
        </button>
      </Faixa>
      <div className="container pagina">
        <PainelAuditoria
          aud={aud}
          topo={
            <div className="nao-imprimir" style={{ maxWidth: 720 }}>
              <SeletorAuditoria atual={aud.id} />
            </div>
          }
        />
      </div>
      {editando && (
        <FormAuditoria
          inicial={aud}
          aoFechar={() => setEditando(false)}
          aoSalvar={async (a) => {
            await d.salvarAuditoria(a as Auditoria);
            avisar(`Auditoria ${aud.id} atualizada.`);
          }}
        />
      )}
    </>
  );
}

