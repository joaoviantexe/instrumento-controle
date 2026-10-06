import { Link } from 'react-router-dom';
import { ArrowRight, FileSpreadsheet } from 'lucide-react';
import { Etiqueta, Faixa } from '../components/ui';
import { ROTAS_PASSOS } from '../components/navegacao';
import { TEXTOS } from '../data/planilha';
import { fraseado } from '../lib/format';

export function Instrucoes() {
  const t = TEXTOS.instrucoes;
  return (
    <>
      <Faixa sobre="Instruções" titulo={t.titulo} sub={t.subtitulo} />
      <div className="container pagina">
        <section className="cartao" aria-label={t.titulo}>
          <ol className="lista-simples" style={{ counterReset: 'none' }}>
            {t.passos.map((p, n) => (
              <li key={p.titulo} style={{ alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <span className="passo__num" aria-hidden>
                    {n + 1}
                  </span>
                  <div>
                    <h2 className="titulo-bloco" style={{ marginBottom: 4 }}>
                      {p.titulo}
                    </h2>
                    <p className="texto-muted">{p.descricao}</p>
                  </div>
                </div>
                <Link to={ROTAS_PASSOS[n]} className="btn btn--contorno btn--pequeno nao-imprimir">
                  Acessar <ArrowRight size={14} aria-hidden />
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section className="cartao" id="criterios" aria-labelledby="titulo-criterios">
          <div className="cartao__cab">
            <h2 id="titulo-criterios" className="titulo-bloco">
              {fraseado(t.criteriosTitulo)}
            </h2>
          </div>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  {t.criteriosCabecalho.map((c) => (
                    <th key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.criterios.map((c) => (
                  <tr key={c.situacao}>
                    <td>
                      <Etiqueta valor={c.situacao} />
                    </td>
                    <td className="nowrap forte">{c.pontuacao}</td>
                    <td>{c.significado}</td>
                    <td>{c.encaminhamento}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="cartao" aria-labelledby="titulo-fontes">
          <div className="cartao__cab">
            <h2 id="titulo-fontes" className="titulo-bloco">
              {fraseado(t.fontesTitulo)}
            </h2>
          </div>
          <ul className="lista-simples">
            {t.fontes.map((f) => (
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
