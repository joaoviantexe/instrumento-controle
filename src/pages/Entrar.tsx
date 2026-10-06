import { useState, type FormEvent } from 'react';
import { LogIn } from 'lucide-react';
import { Faixa, Nota } from '../components/ui';
import { useSessao } from '../lib/sessao';
import { TEXTOS } from '../data/planilha';

export function Entrar() {
  const { entrar } = useSessao();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(await entrar(email, senha));
    setEnviando(false);
  }

  return (
    <>
      <Faixa sobre="CDE · SEMEC" titulo="Instrumento de Controle da Documentação Escolar" sub={TEXTOS.dashboard.subtitulo} bruto />
      <div className="container">
        <form className="cartao login" onSubmit={enviar}>
          <div className="cartao__cab">
            <h2 className="titulo-bloco">Entrar</h2>
          </div>
          <div className="cartao__corpo" style={{ display: 'grid', gap: 14 }}>
            <div className="campo">
              <label htmlFor="email">E-mail</label>
              <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="campo">
              <label htmlFor="senha">Senha</label>
              <input
                id="senha"
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>
            {erro && <Nota tipo="alerta">{erro}</Nota>}
            <button type="submit" className="btn btn--primario" disabled={enviando}>
              <LogIn size={16} aria-hidden /> {enviando ? 'Entrando…' : 'Entrar'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export function SemAcesso() {
  const { email, mensagem, sair } = useSessao();
  return (
    <>
      <Faixa sobre="CDE · SEMEC" titulo="Instrumento de Controle da Documentação Escolar" />
      <div className="container">
        <div className="cartao login">
          <div className="cartao__corpo" style={{ display: 'grid', gap: 14 }}>
            <Nota tipo="alerta">
              {mensagem ? (
                <>Não foi possível verificar o acesso: {mensagem}</>
              ) : (
                <>
                  O e-mail <strong>{email}</strong> ainda não está autorizado. Solicite à Coordenadoria de Documentação
                  Escolar a inclusão na lista de membros.
                </>
              )}
            </Nota>
            <button type="button" className="btn btn--neutro" onClick={() => void sair()}>
              Sair
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
