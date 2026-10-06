import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Accessibility, Cloud, Contrast, HardDrive, LogOut, User, X, ZoomIn, ZoomOut } from 'lucide-react';
import { SECOES_APP } from './navegacao';
import { TEXTOS } from '../data/planilha';
import { useSessao } from '../lib/sessao';
import { supabaseConfigurado } from '../lib/backend/supabase';
import { Avisos } from './ui';
import { fraseado } from '../lib/format';

const CHAVE_PREF = 'instrumento-cde:acessibilidade';

function usePreferenciasAcessibilidade() {
  const [pref, setPref] = useState<{ contraste: boolean; fonte: number }>(() => {
    try {
      return { contraste: false, fonte: 0, ...JSON.parse(localStorage.getItem(CHAVE_PREF) ?? '{}') };
    } catch {
      return { contraste: false, fonte: 0 };
    }
  });
  useEffect(() => {
    const html = document.documentElement;
    if (pref.contraste) html.dataset.contraste = 'alto';
    else delete html.dataset.contraste;
    if (pref.fonte) html.dataset.fonte = String(pref.fonte);
    else delete html.dataset.fonte;
    try {
      localStorage.setItem(CHAVE_PREF, JSON.stringify(pref));
    } catch {
      /* preferências são opcionais */
    }
  }, [pref]);
  return {
    pref,
    alternarContraste: () => setPref((p) => ({ ...p, contraste: !p.contraste })),
    fonte: (delta: number) => setPref((p) => ({ ...p, fonte: Math.max(-1, Math.min(2, p.fonte + delta)) })),
    fontePadrao: () => setPref((p) => ({ ...p, fonte: 0 })),
  };
}

function BarraAcessibilidade() {
  return (
    <div className="barra-acess nao-imprimir">
      <div className="container">
        <ul>
          <li>
            <a href="#conteudo" accessKey="1">
              1 - ir para conteúdo
            </a>
          </li>
          <li>
            <a href="#menu" accessKey="2">
              2 - ir para o menu
            </a>
          </li>
          <li>
            <a href="#rodape" accessKey="3">
              3 - ir para o rodapé
            </a>
          </li>
        </ul>
        <a href="#acessibilidade" accessKey="5">
          5 - recursos de acessibilidade
        </a>
      </div>
    </div>
  );
}

function BarraGov() {
  const { pref, alternarContraste, fonte, fontePadrao } = usePreferenciasAcessibilidade();
  const { status, email, sair } = useSessao();
  return (
    <div className="barra-gov">
      <div className="container">
        <span className="barra-gov__orgao">Prefeitura Municipal de Belém</span>
        <span className="barra-gov__sep" aria-hidden />
        <div className="barra-gov__ferramentas" id="acessibilidade" role="group" aria-label="Recursos de acessibilidade">
          <button
            type="button"
            className="icone-btn"
            onClick={alternarContraste}
            aria-pressed={pref.contraste}
            title="Alto contraste"
            aria-label="Alto contraste"
          >
            <Contrast size={20} />
          </button>
          <button type="button" className="icone-btn" onClick={() => fonte(-1)} title="Diminuir fonte" aria-label="Diminuir fonte">
            <ZoomOut size={20} />
          </button>
          <button type="button" className="icone-btn" onClick={() => fonte(1)} title="Aumentar fonte" aria-label="Aumentar fonte">
            <ZoomIn size={20} />
          </button>
          <button type="button" className="icone-btn" onClick={fontePadrao} title="Fonte padrão" aria-label="Fonte padrão">
            <Accessibility size={20} />
          </button>
        </div>
        <span className="barra-gov__sep" aria-hidden />
        <div className="barra-gov__direita">
          {supabaseConfigurado ? (
            <span className="modo-dados" title="Dados salvos no banco compartilhado (Supabase)">
              <Cloud size={18} aria-hidden /> <span>Banco compartilhado</span>
            </span>
          ) : (
            <Link
              to="/dados"
              className="modo-dados"
              style={{ color: '#fff', textDecoration: 'none' }}
              title="Dados salvos somente neste navegador"
            >
              <HardDrive size={18} aria-hidden /> <span>Modo local</span>
            </Link>
          )}
          {supabaseConfigurado &&
            (status === 'ok' || status === 'nao-autorizado' ? (
              <button type="button" className="pilula-branca" onClick={() => void sair()} title={email ?? ''}>
                sair <LogOut size={16} aria-hidden />
              </button>
            ) : (
              <Link to="/" className="pilula-branca">
                entrar <User size={16} aria-hidden />
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}

function Gaveta({ aoFechar }: { aoFechar: () => void }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, [aoFechar]);
  return createPortal(
    <>
      <div className="veu" onClick={aoFechar} />
      <div className="gaveta" role="dialog" aria-modal="true" aria-label="Menu">
        <div className="gaveta__topo">
          <img src="/logo-educacao-belem-horizontal.png" alt="Educação — Prefeitura de Belém" />
          <button type="button" className="icone-btn" onClick={aoFechar} aria-label="Fechar menu" autoFocus>
            <X size={24} />
          </button>
        </div>
        <nav aria-label="Menu principal">
          <ul>
            {SECOES_APP.map((s) => (
              <li key={s.rota}>
                <NavLink to={s.rota} end={s.rota === '/'} onClick={aoFechar}>
                  <s.icone size={20} aria-hidden />
                  <span>
                    <strong>{s.rotulo}</strong>
                    <small>{s.descricao}</small>
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>,
    document.body,
  );
}

function Cabecalho() {
  const [aberto, setAberto] = useState(false);
  return (
    <header className="cabecalho">
      <div className="container">
        <button
          type="button"
          className="btn-menu nao-imprimir"
          onClick={() => setAberto(true)}
          aria-expanded={aberto}
          aria-haspopup="dialog"
        >
          <span className="btn-menu__barras" aria-hidden>
            <span />
            <span />
            <span />
          </span>
          <span className="btn-menu__texto">Menu</span>
        </button>
        <Link to="/" className="cabecalho__titulo">
          <strong>Instrumento de Controle da Documentação Escolar</strong>
          <span>Coordenadoria de Documentação Escolar — CDE · SEMEC</span>
        </Link>
        <Link to="/" className="cabecalho__logo" aria-label="Início">
          <img className="logo" src="/logo-educacao-belem-horizontal.png" alt="Educação — Prefeitura de Belém" />
        </Link>
      </div>
      {aberto && <Gaveta aoFechar={() => setAberto(false)} />}
    </header>
  );
}

function Abas() {
  return (
    <nav className="abas" id="menu" aria-label="Seções do instrumento">
      <div className="container">
        <ul>
          {SECOES_APP.filter((s) => s.aba).map((s) => (
            <li key={s.rota}>
              <NavLink to={s.rota} end={s.rota === '/'}>
                <s.icone size={16} aria-hidden />
                {s.rotulo}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function Rodape() {
  const grupos = [SECOES_APP.slice(1, 6), SECOES_APP.slice(6)];
  return (
    <footer id="rodape">
      <div className="rodape">
        <div className="container">
          <div>
            <img src="/logo-educacao-belem-vertical.png" alt="Educação — Prefeitura de Belém" />
          </div>
          {grupos.map((g, n) => (
            <nav key={n} aria-label={n === 0 ? 'Cadastro e auditoria' : 'Acompanhamento'}>
              <h2>{n === 0 ? 'Instrumento' : 'Acompanhamento'}</h2>
              <ul>
                {g.map((s) => (
                  <li key={s.rota}>
                    <Link to={s.rota}>{s.rotulo}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div>
            <h2>{fraseado(TEXTOS.dashboard.legendaTitulo)}</h2>
            <ul>
              {TEXTOS.dashboard.legenda.map((l) => (
                <li key={l.situacao}>
                  <strong>{l.situacao}</strong> — {l.descricao}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="rodape__base">
        <div className="container">
          <span>Secretaria Municipal de Educação e Cultura — SEMEC</span>
          <span>Coordenadoria de Documentação Escolar — CDE</span>
        </div>
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
  return (
    <>
      <RolarAoTopo />
      <BarraAcessibilidade />
      <BarraGov />
      <Cabecalho />
      <Abas />
      <main id="conteudo" tabIndex={-1}>
        {children ?? <Outlet />}
      </main>
      <Rodape />
      <Avisos />
    </>
  );
}
