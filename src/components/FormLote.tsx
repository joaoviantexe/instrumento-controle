import { useState } from 'react';
import { Save } from 'lucide-react';
import { PRIORIDADES, ROTULOS_PLANO as R, SITUACOES_AUDITORIA, TEXTOS, TIPOS_VERIFICACAO } from '../data/planilha';
import type { Auditoria } from '../lib/types';
import { fraseado } from '../lib/format';
import { CampoSelect, CampoTexto, Nota, Painel } from './ui';

export type AlteracoesLote = Partial<Pick<Auditoria, 'tipo' | 'prioridade' | 'data_planejada' | 'equipe' | 'situacao'>>;

/** Planejamento em lote: só os campos preenchidos são aplicados às auditorias selecionadas. */
export function FormLote({
  quantidade,
  aoAplicar,
  aoFechar,
}: {
  quantidade: number;
  aoAplicar: (alteracoes: AlteracoesLote) => Promise<void>;
  aoFechar: () => void;
}) {
  const [v, setV] = useState({ tipo: '', prioridade: '', data_planejada: '', equipe: '', situacao: '' });
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof typeof v) => (valor: string) => setV((x) => ({ ...x, [k]: valor }));
  const preenchidos = Object.entries(v).filter(([, valor]) => valor.trim());

  async function aplicar() {
    setSalvando(true);
    try {
      await aoAplicar(Object.fromEntries(preenchidos.map(([k, valor]) => [k, valor.trim()])) as AlteracoesLote);
      aoFechar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Painel
      titulo={`${fraseado(TEXTOS.planoAuditoria.titulo)} — ${quantidade} selecionadas`}
      sub={TEXTOS.instrucoes.passos[1].descricao}
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" className="btn btn--neutro" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="button" className="btn btn--primario" disabled={salvando || preenchidos.length === 0} onClick={() => void aplicar()}>
            <Save size={16} aria-hidden /> Aplicar a {quantidade}
          </button>
        </>
      }
    >
      <div style={{ marginBottom: 18 }}>
        <Nota>
          Preencha apenas o que deve mudar: os campos deixados em branco permanecem como estão em cada auditoria.
        </Nota>
      </div>
      <div className="grade-form">
        <CampoSelect rotulo={R.tipo} valor={v.tipo} aoMudar={set('tipo')} opcoes={TIPOS_VERIFICACAO} vazio="— não alterar —" />
        <CampoSelect rotulo={R.prioridade} valor={v.prioridade} aoMudar={set('prioridade')} opcoes={PRIORIDADES} vazio="— não alterar —" />
        <CampoTexto rotulo={R.dataPlanejada} tipo="date" valor={v.data_planejada} aoMudar={set('data_planejada')} />
        <CampoSelect rotulo={R.situacao} valor={v.situacao} aoMudar={set('situacao')} opcoes={SITUACOES_AUDITORIA} vazio="— não alterar —" />
        <CampoTexto rotulo={R.equipe} valor={v.equipe} aoMudar={set('equipe')} largo />
      </div>
    </Painel>
  );
}
