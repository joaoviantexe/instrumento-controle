import { Link } from 'react-router-dom';
import { ArrowRight, FileSpreadsheet } from 'lucide-react';
import { Etiqueta, Faixa, Nota } from '../components/ui';
import { PainelKpis } from '../components/PainelKpis';
import { ROTAS_PASSOS } from '../components/navegacao';
import { TEXTOS, ROTULOS_ACAO, ROTULOS_PLANO } from '../data/planilha';
import { useDados } from '../lib/store';
import { useRecorte } from '../lib/indicadores';
import { acaoEmAberto, diasRestantes } from '../lib/calc';
import { formatarData, fraseado } from '../lib/format';


export function Inicio() {
  const d = useDados();
  const recorte = useRecorte('');
  const i = TEXTOS.instrucoes;

  const acoesAbertas = d.acoes
    .filter(acaoEmAberto)
    .map((a) => ({ a, dias: diasRestantes(a.prazo) }))
    .sort((x, y) => (x.dias ?? 1e9) - (y.dias ?? 1e9))
    .slice(0, 6);

  const proximas = d.auditorias
    .filter((a) => a.situacao === 'Agendada' || a.situacao === 'Em execução' || (a.situacao === 'Planejada' && a.data_planejada))
    .sort((x, y) => (x.data_planejada || '9999').localeCompare(y.data_planejada || '9999'))
    .slice(0, 6);

  return (
    <>
      <Faixa
        inicio
        sobre="Coordenadoria de Documentação Escolar — CDE · SEMEC"
        titulo="Instrumento de Controle da Documentação Escolar"
        sub={i.subtitulo}
      >
        <Link to="/dashboard" className="btn btn--claro">
          Dashboard
        </Link>
        <Link to="/instrucoes" className="btn btn--claro">
          {fraseado(i.titulo)}
        </Link>
      </Faixa>

      <div className="container pagina">
        <PainelKpis recorte={recorte} sobreposto />
        {d.unidades.length === 0 && (
          <Nota tipo="alerta">
            O banco de dados está vazio. Acesse <Link to="/dados">Dados e backup</Link> e use{' '}
            <strong>Carregar dados da planilha</strong>.
          </Nota>
        )}

        <section aria-labelledby="fluxo" style={{ display: 'grid', gap: 20 }}>
          <h2 id="fluxo" className="titulo-secao">
            {fraseado(i.titulo)}
          </h2>
          <div className="grade-4">
            {i.passos.map((p, n) => {
              const [num, ...resto] = p.titulo.split('. ');
              return (
                <article className="passo" key={p.titulo}>
                  <span className="passo__num" aria-hidden>
                    {num}
                  </span>
                  <h3>{resto.join('. ')}</h3>
                  <p>{p.descricao}</p>
                  <Link to={ROTAS_PASSOS[n]} className="btn btn--contorno btn--pequeno">
                    Acessar <ArrowRight size={14} aria-hidden />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        <div className="grade-2">
          <section className="cartao" aria-labelledby="pend-acoes">
            <div className="cartao__cab">
              <h2 id="pend-acoes" className="titulo-bloco">
                {fraseado(TEXTOS.planoAcao.titulo)}
              </h2>
              <Link to="/plano-de-acao" className="btn btn--contorno btn--pequeno">
                Ver todas
              </Link>
            </div>
            {acoesAbertas.length === 0 ? (
              <p className="tabela-vazia">{TEXTOS.planoAcao.nota}</p>
            ) : (
              <ul className="lista-simples">
                {acoesAbertas.map(({ a, dias }) => (
                  <li key={a.id}>
                    <div>
                      <Link to={`/plano-de-acao?acao=${a.id}`}>
                        {a.id} · {a.item}
                      </Link>
                      <div className="pequeno texto-muted">{d.unidadePorId.get(a.unidade_id)?.nome ?? '—'}</div>
                      <div className="pequeno">{a.acao || a.achado}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Etiqueta valor={a.situacao} />
                      <div className="pequeno texto-muted" style={{ marginTop: 4 }}>
                        {ROTULOS_ACAO.diasRestantes}:{' '}
                        <strong style={{ color: dias !== null && dias < 0 ? 'var(--perigo)' : undefined }}>
                          {dias ?? '—'}
                        </strong>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="cartao" aria-labelledby="prox-aud">
            <div className="cartao__cab">
              <h2 id="prox-aud" className="titulo-bloco">
                {fraseado(TEXTOS.planoAuditoria.titulo)}
              </h2>
              <Link to="/plano-de-auditoria" className="btn btn--contorno btn--pequeno">
                Ver todas
              </Link>
            </div>
            {proximas.length === 0 ? (
              <p className="tabela-vazia">{i.passos[1].descricao}</p>
            ) : (
              <ul className="lista-simples">
                {proximas.map((a) => (
                  <li key={a.id}>
                    <div>
                      <Link to={`/auditoria-documental/${a.id}`}>
                        {a.id} · {d.unidadePorId.get(a.unidade_id)?.nome ?? '—'}
                      </Link>
                      <div className="pequeno texto-muted">
                        {a.tipo || '—'} · {ROTULOS_PLANO.equipe}: {a.equipe || '—'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Etiqueta valor={a.situacao} />
                      <div className="pequeno texto-muted" style={{ marginTop: 4 }}>
                        {formatarData(a.data_planejada) || '—'}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="faixa-escura" aria-labelledby="fontes">
        <div className="container" style={{ display: 'grid', gap: 24 }}>
          <h2 id="fontes">{fraseado(i.fontesTitulo)}</h2>
          <div className="grade-2">
            {i.fontes.map((f) => (
              <div className="cartao-escuro" key={f.arquivo}>
                <FileSpreadsheet size={28} aria-hidden style={{ flexShrink: 0, color: 'var(--verde)' }} />
                <div>
                  <strong>{f.arquivo}</strong>
                  <p>{f.descricao}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
