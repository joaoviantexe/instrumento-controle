import { ExternalLink, Landmark } from 'lucide-react';
import { CLASSE_SITUACAO_VINCULO } from '../lib/conferencias';
import { useDados } from '../lib/store';
import { ATOS_DIARIO, atosDaUnidade, DIARIO_URL, linkDiario, PAINEL_DIARIO, referenciaDiario, ROTULO_CONFIANCA, tituloAto } from '../lib/diario';

/** Atos do Diário Oficial ligados à unidade, cada um com o link que abre a edição na página do ato. */
export function AtosDiario({ unidadeId }: { unidadeId: string }) {
  const { mapaConferencias } = useDados();
  const lista = atosDaUnidade(unidadeId, ATOS_DIARIO, mapaConferencias);
  if (lista.length === 0) {
    return <p className="texto-muted">Nenhum ato do Diário Oficial associado a esta unidade ainda.</p>;
  }
  return (
    <div className="atos-diario">
      <ul className="anexos__lista">
        {lista.map(({ ato, vinculo, situacao, conferencia }) => {
          // Depois de confirmada, a explicação automática da dúvida deixa de valer: fica só a observação de quem conferiu.
          const nota = situacao === 'confirmado' ? conferencia?.nota : vinculo.nota;
          const link = linkDiario(ato.publicacao);
          return (
            <li key={ato.id}>
              <Landmark size={20} aria-hidden />
              <div className="anexos__info">
                <span className="atos-diario__titulo">
                  {tituloAto(ato)}
                  <span className="chip chip--azul">{vinculo.relacao}</span>
                  {situacao !== 'alta' && <span className={'chip ' + CLASSE_SITUACAO_VINCULO[situacao]}>{ROTULO_CONFIANCA[situacao]}</span>}
                </span>
                <span className="atos-diario__ementa">{ato.ementa}</span>
                <small>
                  {ato.publicacao ? referenciaDiario(ato.publicacao) : ato.referencia}
                  {nota && <> · {nota}</>}
                  {ato.nota && <> · {ato.nota}</>}
                </small>
              </div>
              {link ? (
                <a className="btn btn--contorno btn--pequeno" href={link} target="_blank" rel="noopener noreferrer" title="Abrir a edição do Diário Oficial na página do ato">
                  <ExternalLink size={14} aria-hidden /> Abrir na p. {ato.publicacao!.pagina}
                </a>
              ) : (
                ato.publicacao && (
                  <a className="btn btn--neutro btn--pequeno" href={PAINEL_DIARIO} target="_blank" rel="noopener noreferrer" title="Procure a edição pela data no painel do Diário Oficial">
                    <ExternalLink size={14} aria-hidden /> Painel do Diário
                  </a>
                )
              )}
            </li>
          );
        })}
      </ul>
      {!DIARIO_URL && (
        <small className="texto-muted">
          Para abrir a edição direto na página, o site precisa estar ligado ao Worker da Cloudflare (variável VITE_ANEXOS_URL ou VITE_DIARIO_URL). Sem ele, use o
          painel do Diário e procure pela data e pela página indicadas.
        </small>
      )}
    </div>
  );
}
