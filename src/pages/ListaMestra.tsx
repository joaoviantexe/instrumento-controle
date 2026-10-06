import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { CampoSelect, Etiqueta, Faixa, Nota } from '../components/ui';
import { CABECALHOS_LISTA as C, LISTA_MESTRA, SECOES, SECOES_CURTAS, TEXTOS } from '../data/planilha';
import { contem, formatarPeso } from '../lib/format';
import { exportarExcel } from '../lib/exportar';
import { abaListaMestra } from '../lib/abas';

const CRITICIDADES = Array.from(new Set(LISTA_MESTRA.map((i) => i.criticidade)));

export function ListaMestra() {
  const t = TEXTOS.listaMestra;
  const [secao, setSecao] = useState('');
  const [criticidade, setCriticidade] = useState('');
  const [busca, setBusca] = useState('');

  const itens = useMemo(
    () =>
      LISTA_MESTRA.filter(
        (i) =>
          (!secao || i.secao === secao) &&
          (!criticidade || i.criticidade === criticidade) &&
          (!busca || [i.codigo, i.item, i.evidencia, i.orientacao, i.responsavel, i.origem].some((v) => contem(v, busca))),
      ),
    [secao, criticidade, busca],
  );
  const pesoTotal = LISTA_MESTRA.reduce((s, i) => s + i.peso, 0);

  return (
    <>
      <Faixa sobre="Lista Mestra" titulo={t.titulo} sub={t.subtitulo} />
      <div className="container pagina">
        <Nota>{t.nota}</Nota>

        <div className="pilulas" role="group" aria-label={C.secao}>
          <button type="button" className="pilula" aria-pressed={!secao} onClick={() => setSecao('')}>
            Todas <b>{LISTA_MESTRA.length}</b>
          </button>
          {SECOES.map((s) => (
            <button
              type="button"
              key={s}
              className="pilula"
              aria-pressed={secao === s}
              onClick={() => setSecao(secao === s ? '' : s)}
              title={s}
            >
              {s.split('.')[0]}. {SECOES_CURTAS[s]} <b>{LISTA_MESTRA.filter((i) => i.secao === s).length}</b>
            </button>
          ))}
        </div>

        <div className="ferramentas">
          <label className="busca">
            <span className="sr-only">Buscar</span>
            <Search size={18} aria-hidden />
            <input
              type="search"
              placeholder={`${C.codigo}, ${C.item}, ${C.evidencia}…`}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
          <CampoSelect
            classe="campo--filtro"
            rotulo={C.criticidade}
            valor={criticidade}
            aoMudar={setCriticidade}
            opcoes={CRITICIDADES}
            vazio="Todas"
          />
          <div className="ferramentas__direita">
            <span className="contagem" style={{ alignSelf: 'center' }}>
              {C.peso} total: <strong>{formatarPeso(pesoTotal)}</strong>
            </span>
            <button
              type="button"
              className="btn btn--contorno"
              onClick={() => void exportarExcel('Lista_Mestra', [abaListaMestra()])}
            >
              <Download size={16} aria-hidden /> Exportar Excel
            </button>
          </div>
        </div>

        {SECOES.filter((s) => itens.some((i) => i.secao === s)).map((s) => {
          const daSecao = itens.filter((i) => i.secao === s);
          return (
            <section className="cartao" key={s} aria-labelledby={`sec-${s.split('.')[0]}`}>
              <div className="cartao__cab">
                <h2 className="titulo-bloco" id={`sec-${s.split('.')[0]}`}>
                  {s}
                </h2>
                <span className="contagem">
                  {daSecao.length} itens · {C.peso}: {formatarPeso(daSecao.reduce((x, i) => x + i.peso, 0))}
                </span>
              </div>
              <div className="tabela-wrap">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th scope="col">{C.codigo}</th>
                      <th scope="col">{C.item}</th>
                      <th scope="col">{C.evidencia}</th>
                      <th scope="col">{C.abrangencia}</th>
                      <th scope="col">{C.criticidade}</th>
                      <th scope="col" className="num">
                        {C.peso}
                      </th>
                      <th scope="col">{C.responsavel}</th>
                      <th scope="col">{C.origem}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daSecao.map((i) => (
                      <tr key={i.codigo}>
                        <td className="nowrap forte">{i.codigo}</td>
                        <td className="larga">
                          <strong>{i.item}</strong>
                          <div className="pequeno texto-muted" style={{ marginTop: 4 }}>
                            <em>{C.orientacao}:</em> {i.orientacao}
                          </div>
                        </td>
                        <td className="media">{i.evidencia}</td>
                        <td>{i.abrangencia}</td>
                        <td>
                          <Etiqueta valor={i.criticidade} />
                        </td>
                        <td className="num forte">{formatarPeso(i.peso)}</td>
                        <td>{i.responsavel}</td>
                        <td className="pequeno">{i.origem}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
        {itens.length === 0 && <p className="tabela-vazia">Nenhum item encontrado.</p>}
      </div>
    </>
  );
}
