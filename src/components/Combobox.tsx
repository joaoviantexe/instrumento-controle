import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { contem } from '../lib/format';

export interface OpcaoCombo {
  valor: string;
  rotulo: string;
  detalhe?: string;
}

/** Campo de seleção com busca (para listas longas, como as 217 unidades). */
export function Combobox({
  rotulo,
  opcoes,
  valor,
  aoMudar,
  obrigatorio,
  erro,
  placeholder = 'Digite para buscar…',
  largo,
  classe,
}: {
  rotulo: string;
  opcoes: OpcaoCombo[];
  valor: string;
  aoMudar: (v: string) => void;
  obrigatorio?: boolean;
  erro?: string;
  placeholder?: string;
  largo?: boolean;
  classe?: string;
}) {
  const id = useId();
  const selecionada = opcoes.find((o) => o.valor === valor);
  const [texto, setTexto] = useState(selecionada?.rotulo ?? '');
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const listaRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!aberto) setTexto(selecionada?.rotulo ?? '');
  }, [selecionada, aberto]);

  const filtradas = useMemo(() => {
    const busca = aberto && texto !== selecionada?.rotulo ? texto : '';
    return opcoes.filter((o) => !busca || contem(o.rotulo, busca) || contem(o.detalhe ?? '', busca)).slice(0, 60);
  }, [opcoes, texto, aberto, selecionada]);

  useEffect(() => {
    listaRef.current?.querySelector(`[data-indice="${ativo}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [ativo]);

  function escolher(o: OpcaoCombo) {
    aoMudar(o.valor);
    setTexto(o.rotulo);
    setAberto(false);
  }

  return (
    <div className={'campo' + (largo ? ' campo--largo' : '') + (classe ? ` ${classe}` : '')} style={{ position: 'relative' }}>
      <label htmlFor={id}>
        {rotulo}
        {obrigatorio && ' *'}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          role="combobox"
          aria-expanded={aberto}
          aria-controls={id + '-lista'}
          aria-autocomplete="list"
          aria-activedescendant={aberto && filtradas[ativo] ? `${id}-op-${ativo}` : undefined}
          aria-invalid={!!erro}
          autoComplete="off"
          value={texto}
          placeholder={placeholder}
          style={{ paddingRight: 60 }}
          onFocus={(e) => {
            e.target.select();
            setAberto(true);
            setAtivo(0);
          }}
          onBlur={() => window.setTimeout(() => setAberto(false), 150)}
          onChange={(e) => {
            setTexto(e.target.value);
            setAberto(true);
            setAtivo(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setAberto(true);
              setAtivo((a) => Math.min(a + 1, filtradas.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setAtivo((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && aberto && filtradas[ativo]) {
              e.preventDefault();
              escolher(filtradas[ativo]);
            } else if (e.key === 'Escape') {
              setAberto(false);
            }
          }}
        />
        <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 2 }}>
          {valor && !obrigatorio && (
            <button
              type="button"
              className="icone-btn"
              style={{ width: 26, height: 26, color: 'var(--muted)' }}
              aria-label="Limpar"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                aoMudar('');
                setTexto('');
              }}
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown size={16} aria-hidden style={{ color: 'var(--muted)', alignSelf: 'center' }} />
        </span>
      </div>
      {aberto && (
        <ul
          id={id + '-lista'}
          role="listbox"
          ref={listaRef}
          style={{
            position: 'absolute',
            zIndex: 20,
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: 280,
            overflowY: 'auto',
            margin: '4px 0 0',
            padding: 4,
            listStyle: 'none',
            background: 'var(--superficie)',
            border: '1px solid var(--borda-forte)',
            borderRadius: 6,
            boxShadow: 'var(--sombra-forte)',
          }}
        >
          {filtradas.length === 0 && <li style={{ padding: '8px 10px', color: 'var(--muted)' }}>Nenhum resultado.</li>}
          {filtradas.map((o, i) => (
            <li
              key={o.valor}
              id={`${id}-op-${i}`}
              data-indice={i}
              role="option"
              aria-selected={o.valor === valor}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => escolher(o)}
              onMouseEnter={() => setAtivo(i)}
              style={{
                padding: '7px 10px',
                borderRadius: 4,
                cursor: 'pointer',
                background: i === ativo ? 'var(--azul-claro)' : undefined,
                fontWeight: o.valor === valor ? 600 : 400,
                fontSize: '0.85rem',
              }}
            >
              {o.rotulo}
              {o.detalhe && <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{o.detalhe}</div>}
            </li>
          ))}
        </ul>
      )}
      {erro && <span className="campo__erro">{erro}</span>}
    </div>
  );
}
