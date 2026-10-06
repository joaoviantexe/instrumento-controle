import { TEXTOS } from '../data/planilha';
import { calcularKpis, type Recorte } from '../lib/indicadores';
import { formatarNumero, formatarPct } from '../lib/format';
import { Kpi } from './ui';

/** Os seis indicadores do Dashboard, com rótulos e legendas da planilha. */
export function PainelKpis({ recorte, sobreposto }: { recorte: Recorte; sobreposto?: boolean }) {
  const k = calcularKpis(recorte);
  const valores = [
    formatarNumero(k.unidades),
    formatarNumero(k.itens),
    formatarNumero(k.auditorias),
    formatarNumero(k.avaliados),
    formatarNumero(k.naoConformes),
    formatarPct(k.indice),
  ];
  const variantes = [undefined, undefined, undefined, undefined, 'alerta', 'verde'] as const;
  return (
    <div className={'kpis' + (sobreposto ? ' kpis--sobreposto' : '')}>
      {TEXTOS.dashboard.kpis.map((kpi, i) => (
        <Kpi key={kpi.rotulo} rotulo={kpi.rotulo} valor={valores[i]} legenda={kpi.legenda} variante={variantes[i]} />
      ))}
    </div>
  );
}
