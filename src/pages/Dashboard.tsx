import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { CampoSelect, COR_SITUACAO, Etiqueta, Faixa, Kpi, Medidor, Nota, Vazio } from '../components/ui';
import { Atencao } from '../components/Atencao';
import { BarrasEmpilhadas, BarrasHorizontais, BarrasSituacao } from '../components/graficos';
import {
  DISTRITOS,
  LISTA_MESTRA,
  ROTULOS_ACAO,
  ROTULOS_PLANO,
  SECOES,
  SECOES_CURTAS,
  SITUACOES_ACAO,
  SITUACOES_AUDITORIA,
  SITUACOES_ITEM,
  TEXTOS,
} from '../data/planilha';
import { useRecorte, calcularKpis } from '../lib/indicadores';
import { useDados } from '../lib/store';
import { acaoAtrasada, distribuicaoDistritos, indiceGlobal, matrizSecoes, qualidadeCadastro } from '../lib/calc';
import { formatarNumero, formatarPct, fraseado } from '../lib/format';

export function Dashboard() {
  const t = TEXTOS.dashboard;
  const d = useDados();
  const [distrito, setDistrito] = useState('');
  const recorte = useRecorte(distrito);
  const k = calcularKpis(recorte);
  const [gSituacao, gSecoes, gDistritos] = t.graficos;
  const dist = distribuicaoDistritos(recorte.unidades).filter((x) => !distrito || x.distrito === distrito);
  const qualidade = qualidadeCadastro(recorte.unidades, t.qualidade);
  const temAvaliacao = recorte.linhas.length > 0;
  const temIndice = k.avaliados > 0;

  const contar = <T,>(lista: T[], chave: (x: T) => string, valores: string[]) =>
    valores.map((v) => ({ chave: v, valor: lista.filter((x) => chave(x) === v).length }));

  // Índice ponderado por seção (seção 7 tem peso zero e fica de fora, como na planilha)
  const indicePorSecao = useMemo(
    () =>
      matrizSecoes(recorte.linhas)
        .filter((m) => m.indice !== null)
        .map((m) => ({ rotulo: SECOES_CURTAS[m.secao], valor: m.indice as number })),
    [recorte.linhas],
  );

  // Índice por distrito: considera só os distritos que já têm auditoria avaliada
  const indicePorDistrito = useMemo(() => {
    return DISTRITOS.map((nome) => {
      const ids = new Set(d.unidades.filter((u) => u.distrito === nome).map((u) => u.id));
      const auds = new Set(d.auditorias.filter((a) => ids.has(a.unidade_id) && a.iniciada).map((a) => a.id));
      const linhas = d.linhas.filter((l) => auds.has(l.auditoria_id));
      const avaliados = linhas.filter((l) => l.situacao !== 'Não avaliado').length;
      return { rotulo: nome, valor: indiceGlobal(linhas), n: avaliados };
    }).filter((x) => x.n > 0);
  }, [d.unidades, d.auditorias, d.linhas]);

  const semDados = (
    <Vazio texto={TEXTOS.instrucoes.passos[2].descricao}>
      <Link to="/auditoria-documental" className="btn btn--primario btn--pequeno">
        Abrir Auditoria Documental
      </Link>
    </Vazio>
  );

  const [kUnidades, kItens, kAuditorias, kAvaliados, kNc, kIndice] = t.kpis;

  return (
    <>
      <Faixa titulo={t.titulo} sub={t.subtitulo}>
        <button type="button" className="btn btn--claro" onClick={() => window.print()}>
          <Printer size={16} aria-hidden /> Imprimir
        </button>
      </Faixa>
      <div className="container pagina">
        <div className="ferramentas">
          <CampoSelect classe="campo--filtro" rotulo="Distrito" valor={distrito} aoMudar={setDistrito} opcoes={DISTRITOS} vazio="Todos" />
        </div>

        {/* Índice global em destaque + demais indicadores */}
        <div className="painel-topo">
          <section className="destaque" aria-label={kIndice.rotulo}>
            <span className="destaque__rotulo">{kIndice.rotulo}</span>
            <span className="destaque__valor">{formatarPct(k.indice)}</span>
            <span className="destaque__meter" aria-hidden>
              <span style={{ width: `${Math.min(1, k.indice) * 100}%` }} />
            </span>
            <span className="destaque__legenda">{kIndice.legenda}</span>
            <small>
              {formatarNumero(k.avaliados)} de {formatarNumero(recorte.linhas.length)} {kAvaliados.rotulo.toLowerCase()}
            </small>
          </section>
          <div className="kpis">
            <Kpi rotulo={kUnidades.rotulo} valor={formatarNumero(k.unidades)} legenda={kUnidades.legenda} />
            <Kpi rotulo={kItens.rotulo} valor={formatarNumero(k.itens)} legenda={kItens.legenda} />
            <Kpi rotulo={kAuditorias.rotulo} valor={formatarNumero(k.auditorias)} legenda={kAuditorias.legenda} />
            <Kpi rotulo={kAvaliados.rotulo} valor={formatarNumero(k.avaliados)} legenda={kAvaliados.legenda} />
            <Kpi rotulo={kNc.rotulo} valor={formatarNumero(k.naoConformes)} legenda={kNc.legenda} variante="alerta" />
          </div>
        </div>

        {!distrito && (
          <section aria-labelledby="atencao" style={{ display: 'grid', gap: 12 }}>
            <h2 id="atencao" className="titulo-bloco">
              Precisa de atenção
            </h2>
            <Atencao />
          </section>
        )}

        <div className="grade-2">
          <section className="cartao" aria-labelledby="g1">
            <div className="cartao__cab">
              <h2 id="g1" className="titulo-bloco">
                {gSituacao}
              </h2>
              <span className="contagem">{formatarNumero(recorte.linhas.length)} registros</span>
            </div>
            <div className="cartao__corpo">
              {!temAvaliacao ? (
                semDados
              ) : (
                <BarrasSituacao
                  rotuloAcessivel={gSituacao}
                  dados={SITUACOES_ITEM.map((s) => ({
                    chave: s,
                    rotulo: <Etiqueta valor={s} />,
                    valor: k.contagem[s],
                    cor: COR_SITUACAO[s],
                  }))}
                />
              )}
            </div>
          </section>

          <section className="cartao" aria-labelledby="g-secao">
            <div className="cartao__cab">
              <h2 id="g-secao" className="titulo-bloco">
                {TEXTOS.relatorios.secoesCabecalho[7]} por seção
              </h2>
              <Link to="/relatorios" className="btn btn--contorno btn--pequeno">
                Relatórios
              </Link>
            </div>
            <div className="cartao__corpo">
              {!temIndice ? (
                semDados
              ) : (
                <BarrasHorizontais
                  rotuloAcessivel={`${TEXTOS.relatorios.secoesCabecalho[7]} por seção`}
                  dados={indicePorSecao}
                  max={1}
                  formatar={(n) => formatarPct(n)}
                />
              )}
            </div>
          </section>
        </div>

        <div className="grade-2" style={distrito ? { gridTemplateColumns: 'minmax(0, 1fr)' } : undefined}>
          {!distrito && (
            <section className="cartao" aria-labelledby="g-dist">
              <div className="cartao__cab">
                <h2 id="g-dist" className="titulo-bloco">
                  {kIndice.rotulo} por distrito
                </h2>
                <span className="contagem">{kIndice.legenda}</span>
              </div>
              <div className="cartao__corpo">
                {indicePorDistrito.length === 0 ? (
                  semDados
                ) : (
                  <BarrasHorizontais
                    rotuloAcessivel={`${kIndice.rotulo} por distrito`}
                    dados={indicePorDistrito}
                    max={1}
                    formatar={(n) => formatarPct(n)}
                  />
                )}
              </div>
            </section>
          )}

          <section className="cartao" aria-labelledby="g3">
            <div className="cartao__cab">
              <h2 id="g3" className="titulo-bloco">
                {gDistritos}
              </h2>
              <span className="contagem">{recorte.unidades.length} unidades</span>
            </div>
            <div className="cartao__corpo">
              <BarrasEmpilhadas
                rotuloAcessivel={gDistritos}
                series={[
                  { nome: t.vinculos[0], cor: 'var(--serie-1)' },
                  { nome: t.vinculos[1], cor: 'var(--serie-2)' },
                ]}
                dados={dist.map((x) => ({ rotulo: x.distrito, valores: [x.municipal, x.osc] }))}
              />
            </div>
          </section>
        </div>

        <div className="grade-2">
          <section className="cartao" aria-labelledby="g4">
            <div className="cartao__cab">
              <h2 id="g4" className="titulo-bloco">
                {fraseado(TEXTOS.planoAuditoria.titulo)}
              </h2>
              <span className="contagem">
                {ROTULOS_PLANO.situacao} · {recorte.auditorias.length}
              </span>
            </div>
            <div className="cartao__corpo">
              <BarrasSituacao
                rotuloAcessivel={`${TEXTOS.planoAuditoria.titulo} — ${ROTULOS_PLANO.situacao}`}
                dados={[
                  ...contar(recorte.auditorias, (a) => a.situacao, SITUACOES_AUDITORIA).map((x) => ({
                    ...x,
                    rotulo: <Etiqueta valor={x.chave} />,
                    cor: COR_SITUACAO[x.chave],
                  })),
                  {
                    chave: `${ROTULOS_PLANO.situacao} não informada`,
                    rotulo: <span className="chip chip--vazio">{ROTULOS_PLANO.situacao} não informada</span>,
                    valor: recorte.auditorias.filter((a) => !a.situacao).length,
                    cor: 'var(--borda-forte)',
                  },
                ]}
              />
            </div>
          </section>

          <section className="cartao" aria-labelledby="g5">
            <div className="cartao__cab">
              <h2 id="g5" className="titulo-bloco">
                {fraseado(TEXTOS.planoAcao.titulo)}
              </h2>
              <span className="contagem">
                {ROTULOS_ACAO.prazo} expirado: <strong>{recorte.acoes.filter((a) => acaoAtrasada(a)).length}</strong>
              </span>
            </div>
            <div className="cartao__corpo">
              {recorte.acoes.length === 0 ? (
                <Vazio texto={TEXTOS.planoAcao.nota}>
                  <Link to="/plano-de-acao" className="btn btn--contorno btn--pequeno">
                    Abrir Plano de Ação
                  </Link>
                </Vazio>
              ) : (
                <BarrasSituacao
                  rotuloAcessivel={`${TEXTOS.planoAcao.titulo} — ${ROTULOS_ACAO.situacao}`}
                  dados={contar(recorte.acoes, (a) => a.situacao, SITUACOES_ACAO).map((x) => ({
                    ...x,
                    rotulo: <Etiqueta valor={x.chave} />,
                    cor: COR_SITUACAO[x.chave],
                  }))}
                />
              )}
            </div>
          </section>
        </div>

        <div className="grade-2">
          <section className="cartao" aria-labelledby="q">
            <div className="cartao__cab">
              <h2 id="q" className="titulo-bloco">
                {fraseado(t.qualidadeTitulo)}
              </h2>
              <Link to="/unidades" className="btn btn--contorno btn--pequeno">
                {TEXTOS.cadastro.titulo}
              </Link>
            </div>
            <div className="tabela-wrap">
              <table className="tabela">
                <thead>
                  <tr>
                    <th scope="col">{t.qualidadeCabecalho[0]}</th>
                    <th scope="col" className="num">
                      {t.qualidadeCabecalho[1]}
                    </th>
                    <th scope="col">{t.qualidadeCabecalho[2]}</th>
                  </tr>
                </thead>
                <tbody>
                  {qualidade.map((q) => (
                    <tr key={q.indicador}>
                      <td>{q.indicador}</td>
                      <td className="num">{formatarNumero(q.registros)}</td>
                      <td style={{ minWidth: 180 }}>
                        <Medidor valor={q.cobertura} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="cartao" aria-labelledby="g2">
            <div className="cartao__cab">
              <h2 id="g2" className="titulo-bloco">
                {gSecoes}
              </h2>
              <span className="contagem">{LISTA_MESTRA.length} itens</span>
            </div>
            <div className="cartao__corpo">
              <BarrasHorizontais
                rotuloAcessivel={gSecoes}
                dados={SECOES.map((s) => ({ rotulo: SECOES_CURTAS[s], valor: LISTA_MESTRA.filter((i) => i.secao === s).length }))}
              />
            </div>
          </section>
        </div>

        <section className="cartao" aria-labelledby="leg">
          <div className="cartao__cab">
            <h2 id="leg" className="titulo-bloco">
              {fraseado(t.legendaTitulo)}
            </h2>
          </div>
          <div className="cartao__corpo grade-auto" style={{ gap: 12 }}>
            {t.legenda.map((l) => (
              <div key={l.situacao} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Etiqueta valor={l.situacao} />
                <span className="pequeno">{l.descricao}</span>
              </div>
            ))}
          </div>
        </section>

        <Nota>{t.nota}</Nota>
      </div>
    </>
  );
}
