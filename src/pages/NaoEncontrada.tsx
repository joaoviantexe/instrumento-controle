import { Link } from 'react-router-dom';
import { Faixa } from '../components/ui';

export function NaoEncontrada() {
  return (
    <>
      <Faixa titulo="Página não encontrada" />
      <div className="container pagina">
        <p>
          <Link to="/" className="btn btn--contorno">
            Voltar ao início
          </Link>
        </p>
      </div>
    </>
  );
}
