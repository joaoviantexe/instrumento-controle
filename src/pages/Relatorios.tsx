import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Printer } from 'lucide-react';
import { CampoSelect, Etiqueta, Faixa, Medidor, Nota } from '../components/ui';
import { DISTRITOS, SITUACOES_ITEM, TEXTOS } from '../data/planilha';
import { useDados } from '../lib/store';
import { useRecorte } from '../lib/indicadores';
import { distribuicaoDistritos, indiceGlobal, matrizSecoes } from '../lib/calc';
import { formatarNumero, formatarPct, fraseado } from '../lib/format';
import { exportarExcel } from '../lib/exportar';
import { abasRelatorios } from '../lib/abas';
import { MatrizBairro } from '../components/MatrizBairro';

export function Relatorios() {
  const d = useDados();
  const t = TEXTOS.relatorios;
  const [distrito, setDistrito] = useState('');
  const [somenteIniciadas, setSomenteIniciadas] = useState(true);
  const recorte = useRecorte(distrito);
  const matriz = useMemo(() => matrizSecoes(recorte.linhas), [recorte.linhas]);
  const dist = useMemo(
    () => distribuicaoDistritos(d.unidades).filter((x) => !distrito || x.distrito === distrito),
    [d.unidades, distrito],
  );
  const auditorias = recorte.auditorias.filter((a) => !somenteIniciadas || a.iniciada);
  const totalMatriz = SITUACOES_ITEM.map((s) => matriz.reduce((x, m) => x + m.contagem[s], 0));
  const totalDist = dist.reduce((x, l) => ({ m: x.m + l.municipal, o: x.o + l.osc, t: x.t + l.total, p: x.p + l.participacao }), {
    m: 0,
    o: 0,
    t: 0,
    p: 0,
  });

  return (
    <>
      <Faixa titulo={t.titulo} sub={t.subtitulo}>
        <button type="button" className="btn btn--claro" onClick={() => window.print()}>
          <Printer size={16} aria-hidden /> Imprimir
        </button>
        <button
          type="button"
          className="btn btn--claro"
          onClick={() => void exportarExcel('Relatorios', abasRelatorios(d, recorte.linhas, recorte.unidades, recorte.auditorias))}
        >
          <Download size={16} aria-hidden /> Exportar Excel
        </button>
      </Faixa>
      <div className="container pagina">
        <div className="ferramentas">
          <CampoSelect classe="campo--filtro" rotulo="Distrito" valor={distrito} aoMudar={setDistrito} opcoes={DISTRITOS} vazio="Todos" />
        </div>
        <Nota>{t.nota}</Nota>

        <section className="cartao" aria-label={t.secoesCabecalho[0]}>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  {t.secoesCabecalho.map((c, i) => (
                    <th key={c} scope="col" className={i > 0 && i < 7 ? 'num' : undefined}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matriz.map((m) => (
                  <tr key={m.secao}>
                    <td className="forte" style={{ minWidth: 240 }}>
                      {m.secao}
                    </td>
                    {SITUACOES_ITEM.map((s) => (
                      <td key={s} className="num">
                        {formatarNumero(m.contagem[s])}
                      </td>
                    ))}
                    <td className="num forte">{formatarNumero(m.total)}</td>
                    <td style={{ minWidth: 160 }}>
                      <Medidor valor={m.indice} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  {totalMatriz.map((v, i) => (
                    <td key={i} className="num">
                      {formatarNumero(v)}
                    </td>
                  ))}
                  <td className="num">{formatarNumero(recorte.linhas.length)}</td>
                  <td>
                    <Medidor valor={recorte.linhas.length ? indiceGlobal(recorte.linhas) : null} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="cartao" aria-labelledby="bairro">
          <div className="cartao__cab">
            <h2 id="bairro" className="titulo-bloco">
              Distrito e Bairro
            </h2>
            <span className="contagem">{recorte.unidades.length} unidades · clique em um número para ver as unidades</span>
          </div>
          <MatrizBairro unidades={recorte.unidades} />
        </section>

        <div className="grade-2" style={{ alignItems: 'start' }}>
          <section className="cartao" aria-labelledby="dist">
            <div className="cartao__cab">
              <h2 id="dist" className="titulo-bloco">
                {fraseado(t.distribuicaoTitulo)}
              </h2>
            </div>
            <div className="tabela-wrap">
              <table className="tabela">
                <thead>
                  <tr>
                    {t.distribuicaoCabecalho.map((c, i) => (
                      <th key={c} scope="col" className={i > 0 && i < 4 ? 'num' : undefined}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dist.map((x) => (
                    <tr key={x.distrito}>
                      <td className="forte">
                        <Link to={`/unidades?distrito=${x.distrito}`}>{x.distrito}</Link>
                      </td>
                      <td className="num">{x.municipal}</td>
                      <td className="num">{x.osc}</td>
                      <td className="num forte">{x.total}</td>
                      <td style={{ minWidth: 150 }}>
                        <Medidor valor={x.participacao} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td className="num">{totalDist.m}</td>
                    <td className="num">{totalDist.o}</td>
                    <td className="num">{totalDist.t}</td>
                    <td>{formatarPct(totalDist.p)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="cartao" aria-labelledby="cons">
            <div className="cartao__cab">
              <h2 id="cons" className="titulo-bloco">
                {fraseado(t.consolidacaoTitulo)}
              </h2>
              <label className="pequeno nao-imprimir" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={somenteIniciadas} onChange={(e) => setSomenteIniciadas(e.target.checked)} />
                Somente auditorias com itens previstos
              </label>
            </div>
            <div className="tabela-wrap tabela-wrap--alta">
              <table className="tabela">
                <thead>
                  <tr>
                    {t.consolidacaoCabecalho.map((c) => (
                      <th key={c} scope="col">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditorias.map((a) => {
                    const s = d.resumos.get(a.id);
                    return (
                      <tr key={a.id}>
                        <td className="forte nowrap">
                          <Link to={`/auditoria-documental/${a.id}`}>{a.id}</Link>
                        </td>
                        <td>{d.unidadePorId.get(a.unidade_id)?.nome}</td>
                        <td>
                          <Etiqueta valor={a.situacao} />
                        </td>
                        <td style={{ minWidth: 130 }}>
                          <Medidor valor={s?.indice ?? null} />
                        </td>
                        <td className="num">{s?.iniciada ? formatarPct(s.checklist) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {auditorias.length === 0 && <p className="tabela-vazia">{TEXTOS.instrucoes.passos[2].descricao}</p>}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
