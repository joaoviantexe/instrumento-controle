import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, CornerDownLeft, School, Search, Wrench, type LucideIcon } from 'lucide-react';
import { SECOES_APP } from './navegacao';
import { useDados } from '../lib/store';
import { contem, fraseado } from '../lib/format';
import { ROTULOS_ACAO, ROTULOS_PLANO, TEXTOS } from '../data/planilha';

interface Resultado {
  chave: string;
  grupo: string;
  titulo: string;
  detalhe?: string;
  para: string;
  Icone: LucideIcon;
}

const POR_GRUPO = 6;

/** Trecho do texto que coincide com a busca, em destaque. */
function Destaque({ texto, busca }: { texto: string; busca: string }): ReactNode {
  const b = busca.trim();
  if (!b) return texto;
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // normalizar não altera o comprimento dos caracteres base; usa o índice da versão normalizada
  const i = norm(texto).indexOf(norm(b));
  if (i < 0) return texto;
  return (
    <>
      {texto.slice(0, i)}
      <mark>{texto.slice(i, i + b.length)}</mark>
      {texto.slice(i + b.length)}
    </>
  );
}

export function BuscaGlobal({ aoFechar }: { aoFechar: () => void }) {
  const d = useDados();
  const navegar = useNavigate();
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState(0);
  const lista = useRef<HTMLUListElement>(null);
  const id = useId();

  const resultados = useMemo<Resultado[]>(() => {
    const out: Resultado[] = [];
    const b = busca.trim();
    for (const s of SECOES_APP) {
      if (!b || contem(s.rotulo, b)) out.push({ chave: 's' + s.rota, grupo: 'Seções', titulo: s.rotulo, para: s.rota, Icone: s.icone });
    }
    if (!b) return out;
    let n = 0;
    for (const u of d.unidades) {
      if ([u.nome, u.inep, u.bairro, u.diretor, u.endereco].some((v) => contem(v, b))) {
        out.push({
          chave: 'u' + u.id,
          grupo: TEXTOS.cadastro.titulo,
          titulo: u.nome,
          detalhe: [u.distrito, u.bairro, u.inep].filter(Boolean).join(' · '),
          para: `/unidades/${u.id}`,
          Icone: School,
        });
        if (++n >= POR_GRUPO) break;
      }
    }
    n = 0;
    for (const a of d.auditorias) {
      const u = d.unidadePorId.get(a.unidade_id);
      if ([a.id, u?.nome ?? '', a.equipe].some((v) => contem(v, b))) {
        out.push({
          chave: 'a' + a.id,
          grupo: fraseado(TEXTOS.planoAuditoria.titulo),
          titulo: `${a.id} — ${u?.nome ?? ''}`,
          detalhe: [a.situacao, a.tipo].filter(Boolean).join(' · ') || ROTULOS_PLANO.situacao + ' não informada',
          para: `/auditoria-documental/${a.id}`,
          Icone: CalendarCheck,
        });
        if (++n >= POR_GRUPO) break;
      }
    }
    n = 0;
    for (const a of d.acoes) {
      if ([a.id, a.achado, a.acao, a.responsavel, d.unidadePorId.get(a.unidade_id)?.nome ?? ''].some((v) => contem(v, b))) {
        out.push({
          chave: 'c' + a.id,
          grupo: fraseado(TEXTOS.planoAcao.titulo),
          titulo: `${a.id} — ${a.acao || a.achado}`,
          detalhe: [ROTULOS_ACAO.situacao + ': ' + a.situacao, d.unidadePorId.get(a.unidade_id)?.nome].filter(Boolean).join(' · '),
          para: `/plano-de-acao?acao=${a.id}`,
          Icone: Wrench,
        });
        if (++n >= POR_GRUPO) break;
      }
    }
    return out;
  }, [busca, d.unidades, d.auditorias, d.acoes, d.unidadePorId]);

  useEffect(() => setAtivo(0), [busca]);
  useEffect(() => {
    lista.current?.querySelector(`[data-i="${ativo}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [ativo]);
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, []);

  function ir(r: Resultado | undefined) {
    if (!r) return;
    aoFechar();
    navegar(r.para);
  }

  let ultimoGrupo = '';
  return createPortal(
    <>
      <div className="veu" onClick={aoFechar} style={{ zIndex: 120 }} />
      <div className="busca-global" role="dialog" aria-modal="true" aria-label="Buscar">
        <div className="busca-global__campo">
          <Search size={20} aria-hidden />
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls={id}
            aria-activedescendant={resultados[ativo] ? `${id}-${ativo}` : undefined}
            placeholder="Buscar unidade, INEP, auditoria, ação ou seção…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setAtivo((a) => Math.min(a + 1, resultados.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setAtivo((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                ir(resultados[ativo]);
              } else if (e.key === 'Escape') {
                aoFechar();
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <ul id={id} role="listbox" ref={lista} className="busca-global__lista">
          {resultados.length === 0 && <li className="busca-global__vazio">Nenhum resultado para “{busca}”.</li>}
          {resultados.map((r, i) => {
            const cab = r.grupo !== ultimoGrupo;
            ultimoGrupo = r.grupo;
            return (
              <li key={r.chave} role="presentation">
                {cab && <div className="busca-global__grupo">{r.grupo}</div>}
                <div
                  id={`${id}-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={i === ativo}
                  className="busca-global__item"
                  onMouseMove={() => setAtivo(i)}
                  onClick={() => ir(r)}
                >
                  <r.Icone size={18} aria-hidden />
                  <span className="busca-global__texto">
                    <strong>
                      <Destaque texto={r.titulo} busca={busca} />
                    </strong>
                    {r.detalhe && <small>{r.detalhe}</small>}
                  </span>
                  {i === ativo && <CornerDownLeft size={14} aria-hidden />}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="busca-global__rodape">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> navegar
          </span>
          <span>
            <kbd>Enter</kbd> abrir
          </span>
          <span>
            <kbd>Ctrl</kbd> <kbd>K</kbd> em qualquer tela
          </span>
        </div>
      </div>
    </>,
    document.body,
  );
}
