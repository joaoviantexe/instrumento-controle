import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useDados } from '../lib/store';
import { itensDeAtencao } from '../lib/pendencias';
import { formatarNumero } from '../lib/format';

/** Painel "o que precisa de atenção": cada cartão leva direto à lista já filtrada. */
export function Atencao() {
  const d = useDados();
  const itens = itensDeAtencao(d);
  return (
    <div className="atencao">
      {itens.map((i) => {
        const ok = i.total === 0;
        return (
          <Link key={i.chave} to={i.para} className={'atencao__item' + (ok ? ' atencao__item--ok' : '')}>
            <span className="atencao__valor">
              {ok ? <CheckCircle2 size={26} aria-label="Nada pendente" /> : formatarNumero(i.total)}
            </span>
            <span className="atencao__texto">
              <strong>{i.rotulo}</strong>
              <small>{i.detalhe}</small>
            </span>
            {!ok && <ArrowRight size={16} aria-hidden />}
          </Link>
        );
      })}
    </div>
  );
}
