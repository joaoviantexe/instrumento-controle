import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';
import { fecharAviso, ouvirAvisos, type Aviso } from '../lib/avisos';
import { formatarPct } from '../lib/format';

/* ------------------------------------------------------------------ */
/* Faixa de título                                                     */
/* ------------------------------------------------------------------ */
export function Faixa({
  sobre,
  titulo,
  sub,
  children,
}: {
  sobre?: string;
  titulo: string;
  sub?: string;
  children?: ReactNode;
  inicio?: boolean;
}) {
  return (
    <header className="pagina-cab">
      <div className="container pagina-cab__linha">
        <div className="pagina-cab__texto">
          {sobre && <p className="pagina-cab__sobre">{sobre}</p>}
          <h1 id="titulo-pagina">{titulo}</h1>
          {sub && <p className="pagina-cab__sub">{sub}</p>}
        </div>
        {children && <div className="pagina-cab__acoes nao-imprimir">{children}</div>}
      </div>
    </header>
  );
}

export function Nota({ tipo = 'info', children }: { tipo?: 'info' | 'alerta' | 'verde'; children: ReactNode }) {
  const Icone = tipo === 'alerta' ? AlertTriangle : tipo === 'verde' ? CheckCircle2 : Info;
  return (
    <div className={'nota' + (tipo !== 'info' ? ` nota--${tipo}` : '')} role="note">
      <Icone size={18} aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Etiquetas                                                           */
/* ------------------------------------------------------------------ */
const CLASSE_ETIQUETA: Record<string, string> = {
  // Situação do item
  Conforme: 'conforme',
  'Parcialmente conforme': 'parcial',
  'Não conforme': 'nc',
  'Não se aplica': 'na',
  'Não avaliado': 'nav',
  // Prioridade
  Imediata: 'nc',
  Alta: 'parcial',
  Média: 'azul',
  Baixa: 'na',
  // Situação da auditoria
  Planejada: 'na',
  Agendada: 'azul',
  'Em execução': 'parcial',
  Concluída: 'conforme',
  Cancelada: 'vazio',
  // Situação da ação
  'Não iniciada': 'na',
  'Em andamento': 'azul',
  Vencida: 'nc',
  Suspensa: 'nav',
  // Validação CDE
  Validada: 'conforme',
  Pendente: 'parcial',
  Reprovada: 'nc',
  // Criticidade
  Crítica: 'nc',
  Moderada: 'azul',
  Síntese: 'na',
  // Requer ação?
  Sim: 'parcial',
  Não: 'vazio',
  // Cadastro
  ATIVA: 'conforme',
  PARALISADA: 'parcial',
  EXTINTA: 'nc',
  'EM REGULARIZAÇÃO': 'azul',
};

export function Etiqueta({ valor, vazio = '—' }: { valor: string | null | undefined; vazio?: string }) {
  if (!valor) return <span className="chip chip--vazio">{vazio}</span>;
  const classe = CLASSE_ETIQUETA[valor];
  return <span className={'chip' + (classe ? ` chip--${classe}` : '')}>{valor}</span>;
}

export const CLASSE_SITUACAO: Record<string, string> = {
  Conforme: 's-conforme',
  'Parcialmente conforme': 's-parcial',
  'Não conforme': 's-nc',
  'Não se aplica': 's-na',
  'Não avaliado': 's-nav',
};

/** Cores das marcas de gráfico para cada situação (status + rótulo, nunca só cor). */
export const COR_SITUACAO: Record<string, string> = {
  Conforme: 'var(--status-bom)',
  'Parcialmente conforme': 'var(--status-alerta)',
  'Não conforme': 'var(--status-critico)',
  'Não se aplica': 'var(--status-neutro)',
  'Não avaliado': 'var(--status-pendente)',
  'Não iniciada': 'var(--status-neutro)',
  'Em andamento': 'var(--serie-1)',
  Concluída: 'var(--status-bom)',
  Vencida: 'var(--status-critico)',
  Suspensa: 'var(--status-pendente)',
  Planejada: 'var(--status-neutro)',
  Agendada: 'var(--serie-1)',
  'Em execução': 'var(--status-alerta)',
  Cancelada: 'var(--status-pendente)',
};

/* ------------------------------------------------------------------ */
/* Medidor de índice                                                   */
/* ------------------------------------------------------------------ */
export function Medidor({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="texto-muted">—</span>;
  return (
    <span className="medidor" title={formatarPct(valor)}>
      <span className="medidor__trilho" aria-hidden>
        <span className="medidor__barra" style={{ width: `${Math.max(0, Math.min(1, valor)) * 100}%` }} />
      </span>
      <span className="medidor__valor">{formatarPct(valor)}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Indicador                                                           */
/* ------------------------------------------------------------------ */
export function Kpi({
  rotulo,
  valor,
  legenda,
  variante,
}: {
  rotulo: string;
  valor: ReactNode;
  legenda?: string;
  variante?: 'verde' | 'alerta';
}) {
  return (
    <div className={'kpi' + (variante ? ` kpi--${variante}` : '')}>
      <span className="kpi__rotulo">{rotulo}</span>
      <span className="kpi__valor">{valor}</span>
      {legenda && <span className="kpi__legenda">{legenda}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Campos de formulário                                                */
/* ------------------------------------------------------------------ */
interface CampoBase {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  dica?: string;
  largo?: boolean;
  obrigatorio?: boolean;
  desabilitado?: boolean;
  erro?: string;
}

export function CampoTexto({
  rotulo,
  valor,
  aoMudar,
  dica,
  largo,
  obrigatorio,
  desabilitado,
  erro,
  tipo = 'text',
  sugestoes,
  placeholder,
}: CampoBase & { tipo?: string; sugestoes?: string[]; placeholder?: string }) {
  const id = useId();
  return (
    <div className={'campo' + (largo ? ' campo--largo' : '')}>
      <label htmlFor={id}>
        {rotulo}
        {obrigatorio && ' *'}
      </label>
      <input
        id={id}
        type={tipo}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        required={obrigatorio}
        disabled={desabilitado}
        list={sugestoes ? id + '-lista' : undefined}
        placeholder={placeholder}
        aria-invalid={!!erro}
      />
      {sugestoes && (
        <datalist id={id + '-lista'}>
          {sugestoes.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {erro && <span className="campo__erro">{erro}</span>}
      {dica && <small>{dica}</small>}
    </div>
  );
}

export function CampoArea({ rotulo, valor, aoMudar, dica, largo = true, obrigatorio, erro }: CampoBase) {
  const id = useId();
  return (
    <div className={'campo' + (largo ? ' campo--largo' : '')}>
      <label htmlFor={id}>
        {rotulo}
        {obrigatorio && ' *'}
      </label>
      <textarea id={id} value={valor} onChange={(e) => aoMudar(e.target.value)} aria-invalid={!!erro} />
      {erro && <span className="campo__erro">{erro}</span>}
      {dica && <small>{dica}</small>}
    </div>
  );
}

export function CampoSelect({
  rotulo,
  valor,
  aoMudar,
  opcoes,
  dica,
  largo,
  obrigatorio,
  desabilitado,
  vazio = '—',
  erro,
  classe,
}: CampoBase & {
  opcoes: (string | { valor: string; rotulo: string })[];
  vazio?: string | false;
  classe?: string;
}) {
  const id = useId();
  const lista = opcoes.map((o) => (typeof o === 'string' ? { valor: o, rotulo: o } : o));
  // Mantém um valor antigo que não esteja mais na lista
  if (valor && !lista.some((o) => o.valor === valor)) lista.push({ valor, rotulo: valor });
  return (
    <div className={'campo' + (largo ? ' campo--largo' : '') + (classe ? ` ${classe}` : '')}>
      <label htmlFor={id}>
        {rotulo}
        {obrigatorio && ' *'}
      </label>
      <select
        id={id}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        required={obrigatorio}
        disabled={desabilitado}
        aria-invalid={!!erro}
      >
        {vazio !== false && <option value="">{vazio}</option>}
        {lista.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      {erro && <span className="campo__erro">{erro}</span>}
      {dica && <small>{dica}</small>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Painel lateral e diálogo                                            */
/* ------------------------------------------------------------------ */
function useTravarRolagem() {
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, []);
}

function useEsc(aoFechar: () => void) {
  const ref = useRef(aoFechar);
  ref.current = aoFechar;
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && ref.current();
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, []);
}

export function Painel({
  titulo,
  sub,
  aoFechar,
  rodape,
  children,
}: {
  titulo: string;
  sub?: string;
  aoFechar: () => void;
  rodape?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useTravarRolagem();
  useEsc(aoFechar);
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const primeiro = ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not(.icone-btn)');
    (primeiro ?? ref.current)?.focus();
    return () => anterior?.focus?.();
  }, []);
  return createPortal(
    <>
      <div className="veu" onClick={aoFechar} />
      <div className="painel" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref} tabIndex={-1}>
        <div className="painel__cab">
          <div>
            <h2 id={id}>{titulo}</h2>
            {sub && <p>{sub}</p>}
          </div>
          <button type="button" className="icone-btn" onClick={aoFechar} aria-label="Fechar">
            <X size={22} />
          </button>
        </div>
        <div className="painel__corpo">{children}</div>
        {rodape && <div className="painel__rodape">{rodape}</div>}
      </div>
    </>,
    document.body,
  );
}

export function Dialogo({
  titulo,
  children,
  confirmar,
  aoConfirmar,
  aoFechar,
  perigo,
}: {
  titulo: string;
  children: ReactNode;
  confirmar: string;
  aoConfirmar: () => void;
  aoFechar: () => void;
  perigo?: boolean;
}) {
  const id = useId();
  useEsc(aoFechar);
  return createPortal(
    <>
      <div className="veu" onClick={aoFechar} style={{ zIndex: 105 }} />
      <div className="dialogo" role="alertdialog" aria-modal="true" aria-labelledby={id}>
        <h2 id={id}>{titulo}</h2>
        <div>{children}</div>
        <div className="dialogo__acoes">
          <button type="button" className="btn btn--neutro" onClick={aoFechar} autoFocus>
            Cancelar
          </button>
          <button
            type="button"
            className={'btn ' + (perigo ? 'btn--perigo' : 'btn--primario')}
            onClick={() => {
              aoConfirmar();
              aoFechar();
            }}
          >
            {confirmar}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Avisos                                                              */
/* ------------------------------------------------------------------ */
export function Avisos() {
  const [lista, setLista] = useState<Aviso[]>([]);
  useEffect(() => ouvirAvisos(setLista), []);
  return (
    <div className="avisos" aria-live="polite">
      {lista.map((a) => (
        <div key={a.id} className={`aviso aviso--${a.tipo}`} role={a.tipo === 'erro' ? 'alert' : 'status'}>
          {a.tipo === 'erro' ? <XCircle size={18} /> : a.tipo === 'sucesso' ? <CheckCircle2 size={18} /> : <Info size={18} />}
          <span>{a.texto}</span>
          <button type="button" onClick={() => fecharAviso(a.id)} aria-label="Fechar aviso">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="carregando" role="status">
      <Loader2 size={32} className="girando" aria-hidden />
      <span>{texto}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ordenação de tabelas                                                */
/* ------------------------------------------------------------------ */
export type Direcao = 'asc' | 'desc';
export interface Ordem<K extends string> {
  campo: K;
  direcao: Direcao;
}

export function useOrdenacao<K extends string>(inicial: K, direcao: Direcao = 'asc') {
  const [ordem, setOrdem] = useState<Ordem<K>>({ campo: inicial, direcao });
  const alternar = (campo: K) =>
    setOrdem((o) => (o.campo === campo ? { campo, direcao: o.direcao === 'asc' ? 'desc' : 'asc' } : { campo, direcao: 'asc' }));
  return { ordem, alternar };
}

export function ordenar<T>(lista: T[], valor: (x: T) => string | number | null, direcao: Direcao): T[] {
  const fator = direcao === 'asc' ? 1 : -1;
  return [...lista].sort((a, b) => {
    const va = valor(a);
    const vb = valor(b);
    const vazioA = va === null || va === '';
    const vazioB = vb === null || vb === '';
    if (vazioA && vazioB) return 0;
    if (vazioA) return 1;
    if (vazioB) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * fator;
    return String(va).localeCompare(String(vb), 'pt-BR', { numeric: true }) * fator;
  });
}

export function Th<K extends string>({
  campo,
  ordem,
  alternar,
  children,
  className,
}: {
  campo: K;
  ordem: Ordem<K>;
  alternar: (c: K) => void;
  children: ReactNode;
  className?: string;
}) {
  const ativo = ordem.campo === campo;
  const Icone = !ativo ? ArrowUpDown : ordem.direcao === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      className={className}
      aria-sort={ativo ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'}
      scope="col"
    >
      <button type="button" onClick={() => alternar(campo)}>
        {children}
        <Icone size={12} aria-hidden style={{ opacity: ativo ? 1 : 0.5 }} />
      </button>
    </th>
  );
}

/**
 * Em telas pequenas, tabelas com a classe "tabela--cartoes" viram cartões.
 * Este gancho copia o texto de cada cabeçalho para o atributo data-rotulo das células.
 */
export function useRotulosCartao() {
  const ref = useRef<HTMLTableElement>(null);
  useLayoutEffect(() => {
    const t = ref.current;
    if (!t) return;
    const rotulos = Array.from(t.querySelectorAll('thead th')).map((th) => th.textContent?.trim() ?? '');
    t.querySelectorAll('tbody tr').forEach((tr) =>
      Array.from(tr.children).forEach((td, i) => td.setAttribute('data-rotulo', rotulos[i] ?? '')),
    );
  });
  return ref;
}
