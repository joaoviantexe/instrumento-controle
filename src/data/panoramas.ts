import { expandir, type Panorama, type PanoramaCompacto } from '../lib/panorama';

/**
 * Panoramas de Matrícula embutidos no site (src/data/panoramas/<ano>.json, gerados por scripts/panorama/extrair.mjs).
 * Cada ano é um arquivo separado, carregado só quando alguém abre as turmas.
 */
const ARQUIVOS = import.meta.glob<PanoramaCompacto>('./panoramas/*.json', { import: 'default' });

const anoDoArquivo = (caminho: string) => Number(/(\d{4})\.json$/.exec(caminho)?.[1] ?? 0);

export const ANOS_EMBUTIDOS: number[] = Object.keys(ARQUIVOS).map(anoDoArquivo).filter(Boolean).sort((a, b) => b - a);

export async function carregarPanoramaEmbutido(ano: number): Promise<Panorama | null> {
  const caminho = Object.keys(ARQUIVOS).find((c) => anoDoArquivo(c) === ano);
  return caminho ? expandir(await ARQUIVOS[caminho]()) : null;
}
