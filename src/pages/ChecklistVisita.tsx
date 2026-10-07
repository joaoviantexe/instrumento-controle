import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Printer } from 'lucide-react';
import { Etiqueta, Faixa, Medidor, Nota, useRotulosCartao } from '../components/ui';
import { Combobox } from '../components/Combobox';
import { Anexos } from '../components/Anexos';
import { ITENS_VISITA, ROTULOS_AUDITORIA_DOC, TEXTOS } from '../data/planilha';
import { useDados } from '../lib/store';
import { linhasDaAuditoria } from '../lib/calc';
import { formatarData, formatarPct } from '../lib/format';

export function ChecklistVisita() {
  const { id } = useParams();
  const d = useDados();
  const navegar = useNavigate();
  const t = TEXTOS.checklistVisita;
  const tabela = useRotulosCartao();
  const aud = id ? d.auditoriaPorId.get(id) : undefined;
  const u = aud ? d.unidadePorId.get(aud.unidade_id) : undefined;
  const resumo = aud ? d.resumos.get(aud.id) : undefined;

  const opcoes = useMemo(
    () =>
      d.auditorias.map((a) => {
        const un = d.unidadePorId.get(a.unidade_id);
        return {
          valor: a.id,
          rotulo: `${a.id} — ${un?.nome ?? ''}`,
          detalhe: [un?.distrito, a.situacao].filter(Boolean).join(' · '),
        };
      }),
    [d.auditorias, d.unidadePorId],
  );

  const linhas = useMemo(() => {
    if (!aud) return [];
    const codigos = new Set(ITENS_VISITA.map((i) => i.codigo));
    return linhasDaAuditoria(aud.id, d.mapaAvaliacoes).filter((l) => codigos.has(l.item));
  }, [aud, d.mapaAvaliacoes]);

  const r = t.rotulos;
  const [cNum, cItem, cSit, cEv, cAch, cReq, cResp, cPrazo] = t.cabecalhos;

  return (
    <>
      <Faixa sobre={aud ? `Checklist da Visita · ${aud.id}` : undefined} titulo={t.titulo} sub={t.subtitulo}>
        {aud && (
          <>
            <button type="button" className="btn btn--claro" onClick={() => window.print()}>
              <Printer size={16} aria-hidden /> Imprimir
            </button>
            <Link to={`/auditoria-documental/${aud.id}#secao-7`} className="btn btn--claro">
              <Pencil size={16} aria-hidden /> Auditoria Documental
            </Link>
          </>
        )}
      </Faixa>
      <div className="container pagina">
        <section className="cartao">
          <div className="cartao__corpo" style={{ display: 'grid', gap: 18 }}>
            <div className="nao-imprimir" style={{ maxWidth: 720 }}>
              <Combobox
                rotulo={r.auditoria}
                opcoes={opcoes}
                valor={aud?.id ?? ''}
                aoMudar={(v) => v && navegar(`/checklist-da-visita/${v}`)}
                obrigatorio
              />
            </div>
            {aud && (
              <dl className="definicoes" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                <div>
                  <dt>{r.auditoria}</dt>
                  <dd className="forte">{aud.id}</dd>
                </div>
                <div>
                  <dt>{r.data}</dt>
                  <dd>{formatarData(aud.data_realizada || aud.data_planejada) || '—'}</dd>
                </div>
                <div className="largo">
                  <dt>{r.unidade}</dt>
                  <dd>{u ? <Link to={`/unidades/${u.id}`}>{u.nome}</Link> : '—'}</dd>
                </div>
                <div>
                  <dt>{r.distrito}</dt>
                  <dd>{u?.distrito || '—'}</dd>
                </div>
                <div>
                  <dt>{r.equipe}</dt>
                  <dd>{aud.equipe || '—'}</dd>
                </div>
                <div>
                  <dt>{r.conclusao}</dt>
                  <dd>
                    <Medidor valor={resumo?.iniciada ? (resumo.checklist ?? 0) : null} />
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </section>

        {aud ? (
          <section className="cartao" aria-label={t.titulo}>
            <div className="tabela-wrap">
              <table className="tabela tabela--cartoes" ref={tabela}>
                <thead>
                  <tr>
                    <th scope="col" className="num">
                      {cNum}
                    </th>
                    <th scope="col">{cItem}</th>
                    <th scope="col">{cSit}</th>
                    <th scope="col">{cEv}</th>
                    <th scope="col">{cAch}</th>
                    <th scope="col">{cReq}</th>
                    <th scope="col">{cResp}</th>
                    <th scope="col">{cPrazo}</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={l.item}>
                      <td className="num forte">{i + 1}</td>
                      <td className="media principal">
                        <strong>{l.def.item}</strong>
                        <div className="pequeno texto-muted">{l.item}</div>
                      </td>
                      <td>
                        <Etiqueta valor={l.situacao} />
                      </td>
                      <td className="media">{l.evidencia}</td>
                      <td className="media">{l.achado}</td>
                      <td>
                        <Etiqueta valor={l.requer_acao} />
                      </td>
                      <td>{l.responsavel}</td>
                      <td className="nowrap">{formatarData(l.prazo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="cartao__corpo pequeno texto-muted">
              {ROTULOS_AUDITORIA_DOC.secao}: {ITENS_VISITA[0]?.secao} · {r.conclusao}:{' '}
              {resumo?.iniciada ? formatarPct(resumo.checklist) : '—'}
            </div>
          </section>
        ) : (
          id && <Nota tipo="alerta">{`${r.auditoria} ${id} não encontrada.`}</Nota>
        )}

        {aud && (
          <section className="cartao nao-imprimir">
            <div className="cartao__cab">
              <h2 className="titulo-bloco">Documentos da visita</h2>
              <span className="contagem">Fotos digitalizadas, ata, comprovantes (PDF)</span>
            </div>
            <div className="cartao__corpo">
              <Anexos entidade="auditoria" entidadeId={aud.id} />
            </div>
          </section>
        )}

        <Nota>{t.nota}</Nota>
      </div>
    </>
  );
}
