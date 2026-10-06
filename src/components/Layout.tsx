import { Fragment, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Cloud, HardDrive, LogOut, Menu, X } from 'lucide-react';
import { SECOES_APP } from './navegacao';
import { useSessao } from '../lib/sessao';
import { supabaseConfigurado } from '../lib/backend/supabase';
import { Avisos } from './ui';

const NOME = 'Instrumento de Controle da Documentação Escolar';
const SUBTITULO = 'Coordenadoria de Documentação Escolar — CDE · SEMEC';

function Marca({ aoClicar }: { aoClicar?: () => void }) {
  return (
    <Link to="/" className="marca" onClick={aoClicar}>
      <span className="marca__orgao">Prefeitura Municipal de Belém</span>
      <strong className="marca__nome">{NOME}</strong>
      <span className="marca__sub">{SUBTITULO}</span>
    </Link>
  );
}

function Usuario() {
  const { status, email, sair } = useSessao();
  return (
    <div className="lateral__usuario">
      {supabaseConfigurado ? (
        <span className="modo-dados" title="Dados salvos no banco compartilhado (Supabase)">
          <Cloud size={16} aria-hidden /> Banco compartilhado
        </span>
      ) : (
        <Link to="/dados" className="modo-dados" title="Dados salvos somente neste navegador">
          <HardDrive size={16} aria-hidden /> Modo local
        </Link>
      )}
      {supabaseConfigurado && (status === 'ok' || status === 'nao-autorizado') && (
        <div className="lateral__sessao">
          <span title={email ?? ''}>{email}</span>
          <button type="button" onClick={() => void sair()}>
            <LogOut size={14} aria-hidden /> sair
          </button>
        </div>
      )}
    </div>
  );
}

function Lateral({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  return (
    <aside className={'lateral nao-imprimir' + (aberta ? ' lateral--aberta' : '')} id="menu" aria-label="Menu">
      <div className="lateral__topo">
        <Marca aoClicar={aoFechar} />
        <button type="button" className="icone-btn lateral__fechar" onClick={aoFechar} aria-label="Fechar menu">
          <X size={22} />
        </button>
      </div>
      <nav className="lateral__nav" aria-label="Seções do instrumento">
        <ul>
          {SECOES_APP.map((s, i) => (
            <Fragment key={s.rota}>
              {i > 0 && SECOES_APP[i - 1].grupo !== s.grupo && <li className="lateral__sep" role="separator" />}
              <li>
                <NavLink to={s.rota} end={s.rota === '/'} onClick={aoFechar} title={s.descricao}>
                  <s.icone size={18} aria-hidden />
                  {s.rotulo}
                </NavLink>
              </li>
            </Fragment>
          ))}
        </ul>
      </nav>
      <Usuario />
    </aside>
  );
}

function BarraMovel({ aoAbrir }: { aoAbrir: () => void }) {
  return (
    <div className="topo nao-imprimir">
      <button type="button" className="icone-btn" onClick={aoAbrir} aria-label="Abrir menu" aria-controls="menu">
        <Menu size={24} />
      </button>
      <Link to="/" className="topo__nome">
        {NOME}
      </Link>
    </div>
  );
}

function Rodape() {
  return (
    <footer className="rodape nao-imprimir">
      <div className="container">
        <span>Prefeitura Municipal de Belém · Secretaria Municipal de Educação e Cultura — SEMEC</span>
        <span>Coordenadoria de Documentação Escolar — CDE</span>
      </div>
    </footer>
  );
}

function RolarAoTopo() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const alvo = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (alvo) {
        alvo.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export function Moldura({ children }: { children?: React.ReactNode }) {
  const { status } = useSessao();
  const [aberta, setAberta] = useState(false);
  const { pathname } = useLocation();
  const completa = status === 'ok';

  useEffect(() => setAberta(false), [pathname]);
  useEffect(() => {
    if (!aberta) return;
    const f = (e: KeyboardEvent) => e.key === 'Escape' && setAberta(false);
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, [aberta]);

  return (
    <div className={'app' + (completa ? '' : ' app--simples')}>
      <RolarAoTopo />
      {completa && <Lateral aberta={aberta} aoFechar={() => setAberta(false)} />}
      {completa && aberta && <div className="veu veu--menu" onClick={() => setAberta(false)} />}
      <div className="app__conteudo">
        {completa ? (
          <BarraMovel aoAbrir={() => setAberta(true)} />
        ) : (
          <div className="topo topo--fixo nao-imprimir">
            <span className="topo__nome">Prefeitura Municipal de Belém</span>
          </div>
        )}
        <main id="conteudo" tabIndex={-1}>
          {children ?? <Outlet />}
        </main>
        <Rodape />
      </div>
      <Avisos />
    </div>
  );
}
