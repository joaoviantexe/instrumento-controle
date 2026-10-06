export type TipoAviso = 'sucesso' | 'erro' | 'info';
export interface Aviso {
  id: number;
  texto: string;
  tipo: TipoAviso;
}

type Ouvinte = (avisos: Aviso[]) => void;
let avisos: Aviso[] = [];
let seq = 0;
const ouvintes = new Set<Ouvinte>();

function emitir() {
  for (const o of ouvintes) o(avisos);
}

export function avisar(texto: string, tipo: TipoAviso = 'sucesso', duracao = 4000) {
  const id = ++seq;
  avisos = [...avisos, { id, texto, tipo }];
  emitir();
  window.setTimeout(() => fecharAviso(id), tipo === 'erro' ? duracao * 2 : duracao);
}

export function fecharAviso(id: number) {
  avisos = avisos.filter((a) => a.id !== id);
  emitir();
}

export function ouvirAvisos(o: Ouvinte): () => void {
  ouvintes.add(o);
  o(avisos);
  return () => ouvintes.delete(o);
}
