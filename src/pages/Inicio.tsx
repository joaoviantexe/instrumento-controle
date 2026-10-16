import { Link } from 'react-router-dom';
import { ArrowRight, FileSpreadsheet } from 'lucide-react';
import { Etiqueta, Faixa, Nota } from '../components/ui';
import { Atencao } from '../components/Atencao';
import { ROTAS_PASSOS } from '../components/navegacao';
import { CABECALHOS_UNIDADE as C, ITENS_TECNICOS, ITENS_VISITA, ROTULOS_ACAO, ROTULOS_PLANO, TEXTOS } from '../data/planilha';
import { useDados } from '../lib/store';
import { acaoEmAberto, diasRestantes, indiceGlobal } from '../lib/calc';
import { formatarData, formatarNumero, formatarPct, fraseado } from '../lib/format';


export function Inicio() {
  const d = useDados();
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

  /** Andamento de cada etapa do fluxo (mesma ordem dos 8 passos da aba Instruções). */
  const iniciadas = d.auditorias.filter((a) => a.iniciada);
  const previstos = iniciadas.reduce((s, a) => s + (d.resumos.get(a.id)?.previstos ?? 0), 0);
  const avaliados = iniciadas.reduce((s, a) => s + (d.resumos.get(a.id)?.avaliados ?? 0), 0);
  const comVisita = iniciadas.filter((a) => (d.resumos.get(a.id)?.checklist ?? 0) >= 1).length;
  const concluidas = d.acoes.filter((a) => a.situacao === 'Concluída').length;
  const atualizadas = d.unidades.filter((u) => u.data_atualizacao).length;
  const comData = d.auditorias.filter((a) => a.data_planejada).length;
  const razao = (n: number, t: number) => (t > 0 ? n / t : null);
  const etapas: { razao: number | null; texto: string }[] = [
    { razao: razao(atualizadas, d.unidades.length), texto: `${atualizadas} de ${d.unidades.length} com ${C.data_atualizacao}` },
    { razao: razao(comData, d.auditorias.length), texto: `${comData} de ${d.auditorias.length} com ${ROTULOS_PLANO.dataPlanejada}` },
    {
      razao: razao(avaliados, previstos),
      texto: previstos ? `${formatarNumero(avaliados)} de ${formatarNumero(previstos)} ${ROTULOS_PLANO.avaliados}` : `${iniciadas.length} auditorias com itens previstos`,
    },
    { razao: previstos ? indiceGlobal(d.linhas) : null, texto: previstos ? `${TEXTOS.dashboard.kpis[5].rotulo}: ${formatarPct(indiceGlobal(d.linhas))}` : `${TEXTOS.dashboard.kpis[5].rotulo}: —` },
    { razao: razao(comVisita, iniciadas.length), texto: `${comVisita} de ${iniciadas.length} com ${ROTULOS_PLANO.checklist}` },
    { razao: null, texto: `${ITENS_TECNICOS.length} itens técnicos · ${ITENS_VISITA.length} de síntese (peso zero)` },
    { razao: razao(concluidas, d.acoes.length), texto: d.acoes.length ? `${concluidas} de ${d.acoes.length} com ${ROTULOS_ACAO.situacao} Concluída` : 'Nenhuma ação registrada' },
    { razao: null, texto: 'Dashboard e Relatórios' },
  ];
  // Próximo passo = primeira etapa de andamento ainda incompleta
  const proximo = etapas.findIndex((e, n) => [0, 1, 2, 6].includes(n) && e.razao !== null && e.razao < 1);

  return (
    <>
      <Faixa
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
        {d.unidades.length === 0 && (
          <Nota tipo="alerta">
            O banco de dados está vazio. Acesse <Link to="/dados">Dados e planilhas</Link> e use{' '}
            <strong>Carregar dados da planilha</strong>.
          </Nota>
        )}

        <section aria-labelledby="atencao" style={{ display: 'grid', gap: 14 }}>
          <h2 id="atencao" className="titulo-secao">
            Precisa de atenção
          </h2>
          <Atencao />
        </section>

        <section aria-labelledby="fluxo" style={{ display: 'grid', gap: 14 }}>
          <h2 id="fluxo" className="titulo-secao">
            {fraseado(i.titulo)}
          </h2>
          <div className="grade-4">
            {i.passos.map((p, n) => {
              const [num, ...resto] = p.titulo.split('. ');
              const e = etapas[n];
              return (
                <article className={'passo' + (n === proximo ? ' passo--proximo' : '')} key={p.titulo}>
                  <div className="passo__topo">
                    <span className="passo__num" aria-hidden>
                      {num}
                    </span>
                    {n === proximo && <span className="chip chip--verde">Próximo passo</span>}
                  </div>
                  <h3>{resto.join('. ')}</h3>
                  <p>{p.descricao}</p>
                  <div className="passo__prog">
                    {e.razao !== null && (
                      <span className="medidor__trilho" aria-hidden>
                        <span className="medidor__barra" style={{ width: `${Math.min(1, e.razao) * 100}%`, display: 'block' }} />
                      </span>
                    )}
                    <small>{e.texto}</small>
                  </div>
                  <Link to={ROTAS_PASSOS[n]} className={'btn btn--pequeno ' + (n === proximo ? 'btn--primario' : 'btn--contorno')}>
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
              <Link to="/plano-de-visita-tecnica" className="btn btn--contorno btn--pequeno">
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

      <div className="container pagina" style={{ paddingTop: 0 }}>
        <section className="cartao" aria-labelledby="fontes">
          <div className="cartao__cab">
            <h2 id="fontes" className="titulo-bloco">
              {fraseado(i.fontesTitulo)}
            </h2>
          </div>
          <ul className="lista-simples">
            {i.fontes.map((f) => (
              <li key={f.arquivo} style={{ justifyContent: 'flex-start' }}>
                <FileSpreadsheet size={22} aria-hidden style={{ color: 'var(--verde-texto)', flexShrink: 0 }} />
                <div>
                  <strong>{f.arquivo}</strong>
                  <p className="texto-muted">{f.descricao}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
