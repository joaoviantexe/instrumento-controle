import { useEffect, useRef, useState } from 'react';
import { Columns3 } from 'lucide-react';

export interface DefColuna {
  id: string;
  rotulo: string;
  /** Colunas fixas (identificação) não podem ser ocultadas. */
  fixa?: boolean;
}

/** Quais colunas da tabela ficam visíveis; a escolha é lembrada neste navegador. */
export function useColunas(chave: string, colunas: DefColuna[], ocultasPadrao: string[]) {
  const armazenamento = `instrumento-cde:colunas:${chave}`;
  const [ocultas, setOcultas] = useState<string[]>(() => {
    try {
      const salvo = localStorage.getItem(armazenamento);
      return salvo ? (JSON.parse(salvo) as string[]) : ocultasPadrao;
    } catch {
      return ocultasPadrao;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(armazenamento, JSON.stringify(ocultas));
    } catch {
      /* preferência opcional */
    }
  }, [armazenamento, ocultas]);
  return {
    colunas,
    visivel: (id: string) => !ocultas.includes(id),
    alternar: (id: string) => setOcultas((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id])),
    padrao: () => setOcultas(ocultasPadrao),
    todas: () => setOcultas([]),
    ocultas,
  };
}

export function SeletorColunas({ estado }: { estado: ReturnType<typeof useColunas> }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);
  const visiveis = estado.colunas.filter((c) => estado.visivel(c.id)).length;
  return (
    <div className="menu-colunas nao-imprimir" ref={raiz}>
      <button type="button" className="btn btn--neutro btn--pequeno" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        <Columns3 size={14} aria-hidden /> Colunas
        <span className="chip chip--azul">{visiveis}</span>
      </button>
      {aberto && (
        <div className="menu-colunas__lista" role="group" aria-label="Colunas visíveis">
          {estado.colunas.map((c) => (
            <label key={c.id}>
              <input type="checkbox" checked={estado.visivel(c.id)} disabled={c.fixa} onChange={() => estado.alternar(c.id)} />
              {c.rotulo}
            </label>
          ))}
          <div className="menu-colunas__acoes">
            <button type="button" onClick={estado.padrao}>
              Padrão
            </button>
            <button type="button" onClick={estado.todas}>
              Todas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
