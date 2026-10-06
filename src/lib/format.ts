const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Data local de hoje no formato AAAA-MM-DD. */
export function hojeISO(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** AAAA-MM-DD → DD/MM/AAAA; outros textos são mantidos. */
export function formatarData(valor: string | null | undefined): string {
  if (!valor) return '';
  const m = ISO.exec(valor);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valor;
}

/** DD/MM/AAAA → AAAA-MM-DD; outros textos são mantidos (ex.: "DEFINITIVO"). */
export function lerData(valor: string): string {
  const s = valor.trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s;
}

export function diasEntre(deISO: string, ateISO: string): number {
  const a = ISO.exec(deISO);
  const b = ISO.exec(ateISO);
  if (!a || !b) return NaN;
  const ua = Date.UTC(+a[1], +a[2] - 1, +a[3]);
  const ub = Date.UTC(+b[1], +b[2] - 1, +b[3]);
  return Math.round((ub - ua) / 86_400_000);
}

const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const num = new Intl.NumberFormat('pt-BR');

/** Formato 0.0% da planilha. */
export function formatarPct(v: number | null | undefined): string {
  return v === null || v === undefined || Number.isNaN(v) ? '—' : pct.format(v);
}

export function formatarNumero(v: number): string {
  return num.format(v);
}

export function formatarPeso(v: number): string {
  return Number.isInteger(v) ? String(v) : num.format(v);
}

export function formatarCep(cep: string): string {
  const d = cep.replace(/\D/g, '');
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : cep;
}

export function formatarTelefone(tel: string): string {
  const d = tel.replace(/\D/g, '');
  if (d.length === 9) return `${d.slice(0, 5)}-${d.slice(5)}`;
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
}

/** Normaliza para busca: minúsculas, sem acentos. */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function contem(alvo: string, busca: string): boolean {
  return normalizar(alvo).includes(normalizar(busca.trim()));
}

/** "PLANO DE AÇÃO CORRETIVA" → "Plano de ação corretiva" (mesmas palavras, em caixa de frase). */
export function fraseado(s: string): string {
  if (s !== s.toUpperCase()) return s;
  const minusculo = s.toLocaleLowerCase('pt-BR');
  return minusculo.charAt(0).toLocaleUpperCase('pt-BR') + minusculo.slice(1);
}
