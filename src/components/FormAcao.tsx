import { useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import {
  LISTA_MESTRA,
  PRIORIDADES,
  ROTULOS_ACAO as R,
  SITUACOES_ACAO,
  TEXTOS,
  VALIDACOES,
} from '../data/planilha';
import type { Acao } from '../lib/types';
import { useDados } from '../lib/store';
import { diasRestantes } from '../lib/calc';
import { hojeISO } from '../lib/format';
import { CampoArea, CampoSelect, CampoTexto, Nota, Painel } from './ui';
import { Combobox } from './Combobox';
import { useOpcoesUnidades } from './FormAuditoria';

export type RascunhoAcao = Omit<Acao, 'id'> & { id?: string };

export function acaoVazia(): RascunhoAcao {
  return {
    auditoria_id: '',
    unidade_id: '',
    item: '',
    achado: '',
    acao: '',
    prioridade: '',
    responsavel: '',
    data_abertura: hojeISO(),
    prazo: '',
    situacao: 'Não iniciada',
    evidencia: '',
    data_conclusao: '',
    validacao: 'Pendente',
  };
}

export function FormAcao({
  inicial,
  aoSalvar,
  aoFechar,
}: {
  inicial: RascunhoAcao;
  aoSalvar: (a: RascunhoAcao) => Promise<void>;
  aoFechar: () => void;
}) {
  const d = useDados();
  const opcoesUnidades = useOpcoesUnidades();
  const opcoesAuditorias = useMemo(
    () =>
      d.auditorias.map((a) => ({
        valor: a.id,
        rotulo: `${a.id} — ${d.unidadePorId.get(a.unidade_id)?.nome ?? ''}`,
        detalhe: [d.unidadePorId.get(a.unidade_id)?.distrito, a.situacao].filter(Boolean).join(' · '),
      })),
    [d.auditorias, d.unidadePorId],
  );
  const [a, setA] = useState<RascunhoAcao>(inicial);
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof Acao) => (v: string) =>
    setA((x) => {
      const novo = { ...x, [k]: v };
      if (k === 'auditoria_id' && v) novo.unidade_id = d.auditoriaPorId.get(v)?.unidade_id ?? x.unidade_id;
      if (k === 'situacao' && v === 'Concluída' && !x.data_conclusao) novo.data_conclusao = hojeISO();
      return novo;
    });

  async function salvar() {
    setTentou(true);
    if (!a.unidade_id || !a.acao.trim()) return;
    setSalvando(true);
    try {
      await aoSalvar(a);
      aoFechar();
    } finally {
      setSalvando(false);
    }
  }

  const dias = diasRestantes(a.prazo);

  return (
    <Painel
      titulo={a.id ? `${R.id}: ${a.id}` : TEXTOS.planoAcao.titulo}
      sub={TEXTOS.planoAcao.subtitulo}
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
      <div style={{ marginBottom: 18 }}>
        <Nota>{TEXTOS.planoAcao.nota}</Nota>
      </div>
      <form
        className="grade-form"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        <Combobox rotulo={R.auditoria} opcoes={opcoesAuditorias} valor={a.auditoria_id} aoMudar={set('auditoria_id')} largo />
        <Combobox
          rotulo={R.unidade}
          opcoes={opcoesUnidades}
          valor={a.unidade_id}
          aoMudar={set('unidade_id')}
          obrigatorio
          largo
          erro={tentou && !a.unidade_id ? 'Selecione a unidade.' : undefined}
        />
        <CampoSelect
          rotulo={R.item}
          valor={a.item}
          aoMudar={set('item')}
          opcoes={LISTA_MESTRA.map((i) => ({ valor: i.codigo, rotulo: `${i.codigo} — ${i.item}` }))}
          largo
        />
        <CampoArea rotulo={R.achado} valor={a.achado} aoMudar={set('achado')} />
        <CampoArea
          rotulo={R.acao}
          valor={a.acao}
          aoMudar={set('acao')}
          obrigatorio
          erro={tentou && !a.acao.trim() ? 'Descreva a ação corretiva.' : undefined}
        />
        <CampoSelect rotulo={R.prioridade} valor={a.prioridade} aoMudar={set('prioridade')} opcoes={PRIORIDADES} />
        <CampoTexto rotulo={R.responsavel} valor={a.responsavel} aoMudar={set('responsavel')} />
        <CampoTexto rotulo={R.dataAbertura} tipo="date" valor={a.data_abertura} aoMudar={set('data_abertura')} />
        <CampoTexto
          rotulo={R.prazo}
          tipo="date"
          valor={a.prazo}
          aoMudar={set('prazo')}
          dica={dias === null ? undefined : `${R.diasRestantes}: ${dias}`}
        />
        <CampoSelect rotulo={R.situacao} valor={a.situacao} aoMudar={set('situacao')} opcoes={SITUACOES_ACAO} />
        <CampoSelect rotulo={R.validacao} valor={a.validacao} aoMudar={set('validacao')} opcoes={VALIDACOES} />
        <CampoArea rotulo={R.evidencia} valor={a.evidencia} aoMudar={set('evidencia')} />
        <CampoTexto rotulo={R.dataConclusao} tipo="date" valor={a.data_conclusao} aoMudar={set('data_conclusao')} />
        <button type="submit" hidden />
      </form>
    </Painel>
  );
}
