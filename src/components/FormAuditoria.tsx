import { useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { PRIORIDADES, ROTULOS_PLANO as R, SITUACOES_AUDITORIA, TEXTOS, TIPOS_VERIFICACAO } from '../data/planilha';
import type { Auditoria } from '../lib/types';
import { useDados } from '../lib/store';
import { CampoArea, CampoSelect, CampoTexto, Painel } from './ui';
import { Combobox } from './Combobox';

export function auditoriaVazia(): Omit<Auditoria, 'id'> & { id?: string } {
  return {
    unidade_id: '',
    tipo: '',
    prioridade: '',
    data_planejada: '',
    data_realizada: '',
    equipe: '',
    situacao: 'Planejada',
    observacoes: '',
    iniciada: false,
  };
}

export function useOpcoesUnidades() {
  const { unidades } = useDados();
  return useMemo(
    () =>
      [...unidades]
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        .map((u) => ({ valor: u.id, rotulo: u.nome, detalhe: [u.distrito, u.bairro, u.inep].filter(Boolean).join(' · ') })),
    [unidades],
  );
}

export function FormAuditoria({
  inicial,
  aoSalvar,
  aoFechar,
}: {
  inicial: Omit<Auditoria, 'id'> & { id?: string };
  aoSalvar: (a: Omit<Auditoria, 'id'> & { id?: string }) => Promise<void>;
  aoFechar: () => void;
}) {
  const d = useDados();
  const opcoes = useOpcoesUnidades();
  const [a, setA] = useState(inicial);
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof Auditoria) => (v: string) => setA((x) => ({ ...x, [k]: v }));
  const unidade = d.unidadePorId.get(a.unidade_id);

  async function salvar() {
    setTentou(true);
    if (!a.unidade_id) return;
    setSalvando(true);
    try {
      await aoSalvar(a);
      aoFechar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Painel
      titulo={a.id ? `${R.id}: ${a.id}` : TEXTOS.planoAuditoria.titulo}
      sub={TEXTOS.instrucoes.passos[1].descricao}
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" className="btn btn--neutro" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="button" className="btn btn--primario" onClick={() => void salvar()} disabled={salvando}>
            <Save size={16} aria-hidden /> Salvar
          </button>
        </>
      }
    >
      <form
        className="grade-form"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        <Combobox
          rotulo={R.unidade}
          opcoes={opcoes}
          valor={a.unidade_id}
          aoMudar={set('unidade_id')}
          obrigatorio
          largo
          erro={tentou && !a.unidade_id ? 'Selecione a unidade.' : undefined}
        />
        <CampoTexto rotulo={R.distrito} valor={unidade?.distrito ?? ''} aoMudar={() => {}} desabilitado />
        <CampoSelect rotulo={R.situacao} valor={a.situacao} aoMudar={set('situacao')} opcoes={SITUACOES_AUDITORIA} />
        <CampoSelect rotulo={R.tipo} valor={a.tipo} aoMudar={set('tipo')} opcoes={TIPOS_VERIFICACAO} />
        <CampoSelect rotulo={R.prioridade} valor={a.prioridade} aoMudar={set('prioridade')} opcoes={PRIORIDADES} />
        <CampoTexto rotulo={R.dataPlanejada} tipo="date" valor={a.data_planejada} aoMudar={set('data_planejada')} />
        <CampoTexto rotulo={R.dataRealizada} tipo="date" valor={a.data_realizada} aoMudar={set('data_realizada')} />
        <CampoTexto rotulo={R.equipe} valor={a.equipe} aoMudar={set('equipe')} largo />
        <CampoArea rotulo={R.observacoes} valor={a.observacoes} aoMudar={set('observacoes')} />
        <button type="submit" hidden />
      </form>
    </Painel>
  );
}
