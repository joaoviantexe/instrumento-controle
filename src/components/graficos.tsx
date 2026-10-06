import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatarNumero, formatarPct } from '../lib/format';

function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.max(260, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, largura };
}

/** Barra horizontal com ponta arredondada (4px) e base reta. */
function caminhoBarra(x: number, y: number, w: number, h: number, raio = 4): string {
  if (w <= 0) return '';
  const r = Math.min(raio, w, h / 2);
  return `M${x},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x} Z`;
}

/** Máximo "redondo" do eixo, com marcação no meio também inteira. */
function escalaMax(max: number): number {
  if (max <= 4) return 4;
  const metade = max / 2;
  const pot = Math.pow(10, Math.floor(Math.log10(metade)));
  const fatores = pot === 1 ? [1, 2, 3, 4, 5, 6, 8, 10] : [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const passo = fatores.map((f) => f * pot).find((p) => p >= metade) ?? 10 * pot;
  return passo * 2;
}

interface Dica {
  x: number;
  y: number;
  texto: ReactNode;
}

/* ------------------------------------------------------------------ */
/* Barras horizontais — uma série                                      */
/* ------------------------------------------------------------------ */
export function BarrasHorizontais({
  dados,
  rotuloAcessivel,
  cor = 'var(--serie-1)',
  max: maxFixo,
  formatar = formatarNumero,
}: {
  dados: { rotulo: string; valor: number }[];
  rotuloAcessivel: string;
  cor?: string;
  /** Valor do fim do eixo (ex.: 1 para percentuais); por padrão é calculado. */
  max?: number;
  formatar?: (n: number) => string;
}) {
  const { ref, largura } = useLargura<HTMLDivElement>();
  const [dica, setDica] = useState<Dica | null>(null);
  const esquerda = Math.min(170, Math.max(110, largura * 0.32));
  const direita = 40;
  const banda = 34;
  const barra = 18;
  const altura = dados.length * banda + 26;
  const max = maxFixo ?? escalaMax(Math.max(...dados.map((d) => d.valor), 1));
  const w = largura - esquerda - direita;
  const x = (v: number) => esquerda + (v / max) * w;
  const ticks = [0, max / 2, max];

  return (
    <div className="grafico" ref={ref}>
      <svg width={largura} height={altura} role="img" aria-label={rotuloAcessivel}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grade-linha" x1={x(t)} x2={x(t)} y1={0} y2={altura - 22} />
            <text x={x(t)} y={altura - 6} fontSize={11} textAnchor="middle">
              {formatar(t)}
            </text>
          </g>
        ))}
        {dados.map((d, i) => {
          const y = i * banda + (banda - barra) / 2;
          return (
            <g key={d.rotulo}>
              <text x={esquerda - 10} y={y + barra / 2 + 4} fontSize={12} textAnchor="end">
                {d.rotulo}
              </text>
              <path d={caminhoBarra(esquerda, y, x(d.valor) - esquerda, barra)} fill={cor} />
              <text className="rotulo-valor" x={x(d.valor) + 6} y={y + barra / 2 + 4} fontSize={12}>
                {formatar(d.valor)}
              </text>
              <rect
                className="alvo"
                x={0}
                y={i * banda}
                width={largura}
                height={banda}
                onMouseMove={(e) => {
                  const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setDica({
                    x: e.clientX - box.left,
                    y: y,
                    texto: (
                      <>
                        {d.rotulo}: <b>{formatar(d.valor)}</b>
                      </>
                    ),
                  });
                }}
                onMouseLeave={() => setDica(null)}
              />
            </g>
          );
        })}
        <line className="eixo" x1={esquerda} x2={esquerda} y1={0} y2={altura - 22} />
      </svg>
      {dica && (
        <div className="dica" style={{ left: dica.x, top: dica.y }}>
          {dica.texto}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Barras horizontais empilhadas — duas séries                         */
/* ------------------------------------------------------------------ */
export function BarrasEmpilhadas({
  dados,
  series,
  rotuloAcessivel,
}: {
  dados: { rotulo: string; valores: number[] }[];
  series: { nome: string; cor: string }[];
  rotuloAcessivel: string;
}) {
  const { ref, largura } = useLargura<HTMLDivElement>();
  const [dica, setDica] = useState<Dica | null>(null);
  const esquerda = 64;
  const direita = 44;
  const banda = 32;
  const barra = 18;
  const vao = 2;
  const altura = dados.length * banda + 26;
  const totais = dados.map((d) => d.valores.reduce((a, b) => a + b, 0));
  const max = escalaMax(Math.max(...totais, 1));
  const w = largura - esquerda - direita;
  const escala = (v: number) => (v / max) * w;
  const ticks = [0, max / 2, max];

  return (
    <div className="grafico" ref={ref}>
      <div className="legenda">
        {series.map((s) => (
          <span key={s.nome}>
            <i style={{ background: s.cor }} aria-hidden />
            {s.nome}
          </span>
        ))}
      </div>
      <svg width={largura} height={altura} role="img" aria-label={rotuloAcessivel}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grade-linha" x1={esquerda + escala(t)} x2={esquerda + escala(t)} y1={0} y2={altura - 22} />
            <text x={esquerda + escala(t)} y={altura - 6} fontSize={11} textAnchor="middle">
              {formatarNumero(t)}
            </text>
          </g>
        ))}
        {dados.map((d, i) => {
          const y = i * banda + (banda - barra) / 2;
          let acumulado = esquerda;
          const segmentos = d.valores.map((v, si) => {
            const largSeg = escala(v);
            const ultimo = d.valores.slice(si + 1).every((r) => r === 0);
            const x0 = acumulado + (si > 0 && largSeg > 0 ? vao : 0);
            const larg = Math.max(0, largSeg - (si > 0 && largSeg > 0 ? vao : 0));
            acumulado += largSeg;
            if (v === 0) return null;
            return (
              <path
                key={si}
                d={ultimo ? caminhoBarra(x0, y, larg, barra) : `M${x0},${y} h${larg} v${barra} h${-larg} Z`}
                fill={series[si].cor}
              >
                <title>{`${d.rotulo} — ${series[si].nome}: ${v}`}</title>
              </path>
            );
          });
          return (
            <g key={d.rotulo}>
              <text x={esquerda - 10} y={y + barra / 2 + 4} fontSize={12} textAnchor="end">
                {d.rotulo}
              </text>
              {segmentos}
              <text className="rotulo-valor" x={esquerda + escala(totais[i]) + 6} y={y + barra / 2 + 4} fontSize={12}>
                {formatarNumero(totais[i])}
              </text>
              <rect
                className="alvo"
                x={0}
                y={i * banda}
                width={largura}
                height={banda}
                onMouseMove={(e) => {
                  const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setDica({
                    x: e.clientX - box.left,
                    y: y + 30,
                    texto: (
                      <>
                        <b>{d.rotulo}</b> ·{' '}
                        {series.map((s, si) => (
                          <span key={s.nome}>
                            {si > 0 && ' · '}
                            {s.nome}: <b>{d.valores[si]}</b>
                          </span>
                        ))}
                      </>
                    ),
                  });
                }}
                onMouseLeave={() => setDica(null)}
              />
            </g>
          );
        })}
        <line className="eixo" x1={esquerda} x2={esquerda} y1={0} y2={altura - 22} />
      </svg>
      {dica && (
        <div className="dica" style={{ left: dica.x, top: dica.y }}>
          {dica.texto}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lista de barras por situação (rótulo + barra + valor + percentual)  */
/* ------------------------------------------------------------------ */
export function BarrasSituacao({
  dados,
  rotuloAcessivel,
}: {
  dados: { rotulo: ReactNode; chave: string; valor: number; cor: string }[];
  rotuloAcessivel: string;
}) {
  const total = dados.reduce((a, d) => a + d.valor, 0);
  const max = Math.max(...dados.map((d) => d.valor), 1);
  return (
    <div className="barras-lista" role="list" aria-label={rotuloAcessivel}>
      {dados.map((d) => (
        <div
          className="barras-lista__linha"
          role="listitem"
          key={d.chave}
          title={`${d.chave}: ${d.valor} (${formatarPct(total ? d.valor / total : 0)})`}
        >
          <span>{d.rotulo}</span>
          <span className="barras-lista__trilho" aria-hidden>
            <span
              className="barras-lista__barra"
              style={{ display: 'block', width: `${(d.valor / max) * 100}%`, background: d.cor, opacity: d.valor ? 1 : 0 }}
            />
          </span>
          <span className="barras-lista__valor">
            {formatarNumero(d.valor)}
            <small>{formatarPct(total ? d.valor / total : 0)}</small>
          </span>
        </div>
      ))}
    </div>
  );
}
