import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Maximize2, Pencil, PlayCircle } from 'lucide-react';
import { TIPOS_VERIFICACAO } from '../data/planilha';
import { auditoriaDeReferencia } from '../lib/checklist';
import { avisar } from '../lib/avisos';
import { formatarData } from '../lib/format';
import { useDados } from '../lib/store';
import type { Auditoria } from '../lib/types';
import { FormAuditoria } from './FormAuditoria';
import { PainelAuditoria } from './PainelAuditoria';
import { Vazio } from './ui';

/**
 * A Auditoria Documental completa dentro da página da unidade: a mesma de /auditoria-documental (todos os itens,
 * evidências, achados, ações, PDFs, grade de turmas), mais o plano de visita técnica e a checklist da visita.
 */
export function AuditoriaUnidade({ unidadeId }: { unidadeId: string }) {
  const d = useDados();
  const auditorias = useMemo(
    () => d.auditorias.filter((a) => a.unidade_id === unidadeId).sort((a, b) => Number(b.iniciada) - Number(a.iniciada) || b.id.localeCompare(a.id)),
    [d.auditorias, unidadeId],
  );
  const [escolhida, setEscolhida] = useState('');
  const [editando, setEditando] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const aud = auditorias.find((a) => a.id === escolhida) ?? auditoriaDeReferencia(auditorias, unidadeId);

  async function iniciar() {
    setIniciando(true);
    try {
      const id = await d.criarAuditoria({
        unidade_id: unidadeId,
        tipo: TIPOS_VERIFICACAO[0],
        prioridade: '',
        data_planejada: '',
        data_realizada: '',
        equipe: '',
        situacao: 'Em execução',
        observacoes: '',
        iniciada: true,
      });
      setEscolhida(id);
      avisar(`Auditoria ${id} iniciada: avalie os documentos abaixo.`);
    } finally {
      setIniciando(false);
    }
  }

  const cabecalho = (
    <header className="auditoria-unidade__cab">
      <h2 id="auditoria-unidade" className="titulo-secao">
        Auditoria Documental
      </h2>
      <p className="texto-muted">
        Tudo da auditoria aqui mesmo: situação de cada documento (e de cada turma), evidência, achado, ação, prazo, responsável, PDFs e registro no
        Plano de Ação.
      </p>
    </header>
  );

  if (!aud) {
    return (
      <>
        {cabecalho}
        <section className="cartao">
          <Vazio texto="Esta unidade ainda não tem auditoria. Inicie uma para avaliar os documentos aqui mesmo, ou envie a checklist da secretaria escolar (acima).">
            <button type="button" className="btn btn--primario btn--pequeno" disabled={iniciando} onClick={() => void iniciar()}>
              <PlayCircle size={14} aria-hidden /> Iniciar auditoria
            </button>
          </Vazio>
        </section>
      </>
    );
  }

  const topo = (
    <div className="auditoria-unidade__topo nao-imprimir">
      {auditorias.length > 1 ? (
        <label className="auditoria-unidade__seletor">
          <span>Auditoria</span>
          <select value={aud.id} onChange={(e) => setEscolhida(e.target.value)}>
            {auditorias.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id} · {a.tipo || 'sem tipo'} · {a.situacao || 'sem situação'}
                {a.data_realizada || a.data_planejada ? ` · ${formatarData(a.data_realizada || a.data_planejada)}` : ''}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <span />
      )}
      <div className="auditoria-unidade__acoes">
        <button type="button" className="btn btn--contorno btn--pequeno" onClick={() => setEditando(true)}>
          <Pencil size={14} aria-hidden /> Plano de Visita Técnica
        </button>
        <Link to={`/checklist-da-visita/${aud.id}`} className="btn btn--contorno btn--pequeno">
          <ClipboardList size={14} aria-hidden /> Checklist da Visita
        </Link>
        <Link to={`/auditoria-documental/${aud.id}`} className="btn btn--neutro btn--pequeno" title="Abrir a mesma auditoria na tela da Auditoria Documental">
          <Maximize2 size={14} aria-hidden /> Tela cheia
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {cabecalho}
      <PainelAuditoria key={aud.id} aud={aud} topo={topo} naUnidade />
      {editando && (
        <FormAuditoria
          inicial={aud}
          aoFechar={() => setEditando(false)}
          aoSalvar={async (a) => {
            await d.salvarAuditoria(a as Auditoria);
            avisar(`Auditoria ${aud.id} atualizada.`);
          }}
        />
      )}
    </>
  );
}
