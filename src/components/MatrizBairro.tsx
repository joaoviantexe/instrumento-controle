import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { matrizBairroDistrito } from '../lib/calc';
import type { Unidade } from '../lib/types';

/** Aba DistritoBairro da planilha: unidades por Bairro × Distrito, sombreadas pela quantidade. */
export function MatrizBairro({ unidades }: { unidades: Unidade[] }) {
  const navegar = useNavigate();
  const m = useMemo(() => matrizBairroDistrito(unidades), [unidades]);
  const max = Math.max(1, ...m.linhas.flatMap((l) => l.contagem));
  return (
    <div className="tabela-wrap tabela-wrap--alta">
      <table className="tabela matriz">
        <thead>
          <tr>
            <th scope="col">Bairro</th>
            {m.distritos.map((d) => (
              <th key={d} scope="col" className="num">
                {d}
              </th>
            ))}
            <th scope="col" className="num">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {m.linhas.map((l) => (
            <tr key={l.bairro}>
              <th scope="row" className="matriz__bairro">
                {l.bairro}
              </th>
              {l.contagem.map((n, i) => (
                <td key={i} className="num matriz__celula">
                  {n > 0 ? (
                    <button
                      type="button"
                      style={{ background: `color-mix(in srgb, var(--serie-1) ${12 + (n / max) * 58}%, transparent)` }}
                      onClick={() =>
                        navegar(`/unidades?distrito=${encodeURIComponent(m.distritos[i])}&bairro=${encodeURIComponent(l.bairro)}`)
                      }
                      title={`${l.bairro} · ${m.distritos[i]}: ${n}`}
                    >
                      {n}
                    </button>
                  ) : (
                    <span className="texto-muted" aria-label="0">
                      ·
                    </span>
                  )}
                </td>
              ))}
              <td className="num forte">{l.total}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            {m.totais.map((t, i) => (
              <td key={i} className="num">
                {t}
              </td>
            ))}
            <td className="num">{m.total}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
