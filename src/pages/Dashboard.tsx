import { useState } from 'react';
import { Printer } from 'lucide-react';
import { CampoSelect, COR_SITUACAO, Etiqueta, Faixa, Medidor, Nota } from '../components/ui';
import { PainelKpis } from '../components/PainelKpis';
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
import { distribuicaoDistritos, qualidadeCadastro, acaoAtrasada } from '../lib/calc';
import { formatarNumero, fraseado } from '../lib/format';

export function Dashboard() {
  const t = TEXTOS.dashboard;
  const [distrito, setDistrito] = useState('');
  const recorte = useRecorte(distrito);
  const k = calcularKpis(recorte);
  const [gSituacao, gSecoes, gDistritos] = t.graficos;
  const dist = distribuicaoDistritos(recorte.unidades).filter((x) => !distrito || x.distrito === distrito);
  const qualidade = qualidadeCadastro(recorte.unidades, t.qualidade);

  const contar = <T,>(lista: T[], chave: (x: T) => string, valores: string[]) =>
    valores.map((v) => ({ chave: v, valor: lista.filter((x) => chave(x) === v).length }));

  return (
    <>
      <Faixa sobre="Dashboard" titulo={t.titulo} sub={t.subtitulo}>
        <button type="button" className="btn btn--claro" onClick={() => window.print()}>
          <Printer size={16} aria-hidden /> Imprimir
        </button>
      </Faixa>
      <div className="container pagina">
        <div className="ferramentas">
          <CampoSelect classe="campo--filtro" rotulo="Distrito" valor={distrito} aoMudar={setDistrito} opcoes={DISTRITOS} vazio="Todos" />
        </div>

        <PainelKpis recorte={recorte} />

        <div className="grade-2">
          <section className="cartao" aria-labelledby="g1">
            <div className="cartao__cab">
              <h2 id="g1" className="titulo-bloco">
                {gSituacao}
              </h2>
              <span className="contagem">{formatarNumero(recorte.linhas.length)} registros</span>
            </div>
            <div className="cartao__corpo">
              {recorte.linhas.length === 0 ? (
                <p className="tabela-vazia">{TEXTOS.instrucoes.passos[2].descricao}</p>
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

        <div className="grade-2">
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

          <section className="cartao" aria-labelledby="q">
            <div className="cartao__cab">
              <h2 id="q" className="titulo-bloco">
                {fraseado(t.qualidadeTitulo)}
              </h2>
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
                <p className="tabela-vazia">{TEXTOS.planoAcao.nota}</p>
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
