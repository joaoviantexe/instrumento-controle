import { ExternalLink, Gavel } from 'lucide-react';
import { PAINEL_CME, resolucoesDaUnidade, tituloResolucao } from '../lib/cme';
import { ROTULO_CONFIANCA } from '../lib/diario';

/** Resoluções do CME ligadas à unidade, cada uma com o link do PDF no site do Conselho. */
export function ResolucoesCme({ unidadeId }: { unidadeId: string }) {
  const lista = resolucoesDaUnidade(unidadeId);
  if (lista.length === 0) {
    return (
      <p className="texto-muted">
        Nenhuma resolução do CME associada a esta unidade ainda.{' '}
        <a href={PAINEL_CME} target="_blank" rel="noopener noreferrer">
          Ver todas as resoluções no site do CME
        </a>
        .
      </p>
    );
  }
  return (
    <div className="atos-diario">
      <ul className="anexos__lista">
        {lista.map(({ resolucao, vinculo }) => (
          <li key={resolucao.id}>
            <Gavel size={20} aria-hidden />
            <div className="anexos__info">
              <span className="atos-diario__titulo">
                {tituloResolucao(resolucao)}
                <span className="chip chip--azul">{vinculo.relacao}</span>
                {vinculo.confianca !== 'alta' && (
                  <span className={'chip ' + (vinculo.confianca === 'media' ? 'chip--parcial' : 'chip--nc')}>{ROTULO_CONFIANCA[vinculo.confianca]}</span>
                )}
              </span>
              <span className="atos-diario__ementa">{resolucao.descricao}</span>
              {vinculo.nota && <small>{vinculo.nota}</small>}
            </div>
            <a className="btn btn--contorno btn--pequeno" href={resolucao.url} target="_blank" rel="noopener noreferrer" title="Abrir o PDF no site do CME">
              <ExternalLink size={14} aria-hidden /> Abrir PDF
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
