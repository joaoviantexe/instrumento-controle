import { ExternalLink, Gavel } from 'lucide-react';
import { PAINEL_CME, RESOLUCOES_CME, resolucoesDaUnidade, tituloResolucao } from '../lib/cme';
import { CLASSE_SITUACAO_VINCULO } from '../lib/conferencias';
import { ROTULO_CONFIANCA } from '../lib/diario';
import { useDados } from '../lib/store';

/** Resoluções do CME ligadas à unidade, cada uma com o link do PDF no site do Conselho. */
export function ResolucoesCme({ unidadeId }: { unidadeId: string }) {
  const { mapaConferencias } = useDados();
  const lista = resolucoesDaUnidade(unidadeId, RESOLUCOES_CME, mapaConferencias);
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
        {lista.map(({ resolucao, vinculo, situacao }) => (
          <li key={resolucao.id}>
            <Gavel size={20} aria-hidden />
            <div className="anexos__info">
              <span className="atos-diario__titulo">
                {tituloResolucao(resolucao)}
                <span className="chip chip--azul">{vinculo.relacao}</span>
                {situacao !== 'alta' && <span className={'chip ' + CLASSE_SITUACAO_VINCULO[situacao]}>{ROTULO_CONFIANCA[situacao]}</span>}
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
