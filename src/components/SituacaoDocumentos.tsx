import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Check, ChevronDown, ChevronUp, ClipboardCheck, PlayCircle, ShieldAlert } from 'lucide-react';
import { SECOES, SECOES_CURTAS, TIPOS_VERIFICACAO } from '../data/planilha';
import { avaliado, linhasDaAuditoria, type Linha } from '../lib/calc';
import { ROTULO_VERIFICACAO, VERIFICACAO_FEITA, VERIFICACAO_PENDENTE, auditoriaDeReferencia, divergeDaDeclaracao, ehPorTurma } from '../lib/checklist';
import { avisar } from '../lib/avisos';
import { formatarData } from '../lib/format';
import { useDados } from '../lib/store';
import { useTurmasDaAuditoria } from '../lib/useTurmas';
import { chaveAvaliacao, type Avaliacao } from '../lib/types';
import { GradeTurmas, SeletorSituacao, comVerificacao } from './AvaliacaoTurmas';
import { Etiqueta, Medidor, Vazio } from './ui';

type Filtro = 'todos' | 'verificar' | 'nc' | 'pendentes';

/** O registro gravado do item (sem os campos calculados). */
function registro(l: Linha): Avaliacao {
  const { def: _def, pesoAplicavel: _pa, pontos: _pontos, indice: _indice, ...av } = l;
  return av;
}

/**
 * Situação de todos os documentos da auditoria da unidade (a mais recente iniciada, ou a escolhida), editável aqui
 * mesmo: a situação de cada documento da unidade e, nos documentos da turma, de cada turma. Mostra o que a secretaria
 * declarou e o que ainda requer verificação da CDE.
 */
export function SituacaoDocumentos({ unidadeId }: { unidadeId: string }) {
  const d = useDados();
  const auditorias = useMemo(
    () => d.auditorias.filter((a) => a.unidade_id === unidadeId).sort((a, b) => Number(b.iniciada) - Number(a.iniciada) || b.id.localeCompare(a.id)),
    [d.auditorias, unidadeId],
  );
  const [escolhida, setEscolhida] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [aberto, setAberto] = useState<string | null>(null);
  const [iniciando, setIniciando] = useState(false);
  const aud = auditorias.find((a) => a.id === escolhida) ?? auditoriaDeReferencia(auditorias, unidadeId);
  const { turmas, ano, carregando } = useTurmasDaAuditoria(aud);
  const linhas = useMemo(() => (aud ? linhasDaAuditoria(aud.id, d.mapaAvaliacoes) : []), [aud, d.mapaAvaliacoes]);
  const anexosPorItem = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of d.anexos) if (a.entidade === 'avaliacao') m.set(a.entidade_id, (m.get(a.entidade_id) ?? 0) + 1);
    return m;
  }, [d.anexos]);

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

  if (!aud) {
    return (
      <Vazio texto="Esta unidade ainda não tem auditoria. Inicie uma para avaliar os documentos aqui mesmo, ou envie a checklist da secretaria escolar (abaixo).">
        <button type="button" className="btn btn--primario btn--pequeno" disabled={iniciando} onClick={() => void iniciar()}>
          <PlayCircle size={14} aria-hidden /> Iniciar auditoria
        </button>
      </Vazio>
    );
  }

  const comTurmas = turmas.length > 0;
  const porTurma = (l: Linha) => comTurmas && ehPorTurma(l.item);
  const turmasDo = (l: Linha) => [...(d.mapaTurmas.get(aud.id)?.get(l.item)?.values() ?? [])];
  const divergentes = (l: Linha) => (porTurma(l) ? turmasDo(l).filter(divergeDaDeclaracao).length : divergeDaDeclaracao(l) ? 1 : 0);
  const precisaVerificar = (l: Linha) => l.verificacao === VERIFICACAO_PENDENTE || divergentes(l) > 0;

  const resumo = d.resumos.get(aud.id);
  const conta = (f: (l: Linha) => boolean) => linhas.filter(f).length;
  const n = {
    avaliados: conta((l) => avaliado(l.situacao)),
    conformes: conta((l) => l.situacao === 'Conforme'),
    parciais: conta((l) => l.situacao === 'Parcialmente conforme'),
    nc: conta((l) => l.situacao === 'Não conforme'),
    na: conta((l) => l.situacao === 'Não se aplica'),
    pendentes: conta((l) => !avaliado(l.situacao)),
    verificar: conta(precisaVerificar),
    verificados: conta((l) => l.verificacao === VERIFICACAO_FEITA),
  };
  const filtros: Record<Filtro, [string, number]> = {
    todos: ['Todos', linhas.length],
    verificar: ['Requer verificação da CDE', n.verificar],
    nc: ['Não conforme / parcial', n.nc + n.parciais],
    pendentes: ['Não avaliado', n.pendentes],
  };
  const visivel = (l: Linha) =>
    filtro === 'verificar'
      ? precisaVerificar(l)
      : filtro === 'nc'
        ? l.situacao === 'Não conforme' || l.situacao === 'Parcialmente conforme'
        : filtro === 'pendentes'
          ? !avaliado(l.situacao)
          : true;

  /** Quem respondeu pela situação do item. */
  function verificacao(l: Linha) {
    if (l.verificacao === VERIFICACAO_PENDENTE) return <span className="chip chip--parcial">{ROTULO_VERIFICACAO[VERIFICACAO_PENDENTE]}</span>;
    const div = divergentes(l);
    if (div) return <span className="chip chip--nc">{porTurma(l) ? `${div} turma(s) divergem da secretaria` : 'Diverge da secretaria'}</span>;
    if (l.verificacao === VERIFICACAO_FEITA) return <span className="chip chip--conforme">{ROTULO_VERIFICACAO[VERIFICACAO_FEITA]}</span>;
    if (avaliado(l.situacao)) return <span className="chip chip--azul">Avaliado pela CDE</span>;
    return <span className="texto-muted">—</span>;
  }

  const salvar = (av: Avaliacao) => void d.salvarAvaliacao(av).catch(() => undefined);

  return (
    <div className="situacao-docs">
      <div className="situacao-docs__topo">
        {auditorias.length > 1 ? (
          <label className="situacao-docs__aud">
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
          <span className="pequeno texto-muted">
            {aud.id} · {aud.tipo || 'sem tipo'} · <Etiqueta valor={aud.situacao} />
          </span>
        )}
        <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
          <Medidor valor={resumo?.indice ?? null} />
          <Link to={`/auditoria-documental/${aud.id}`} className="btn btn--contorno btn--pequeno">
            <ClipboardCheck size={14} aria-hidden /> Abrir a Auditoria Documental
          </Link>
        </span>
      </div>

      <div className="metricas metricas--compactas">
        <div>
          <span>Avaliados</span>
          <strong>
            {n.avaliados}/{linhas.length}
          </strong>
        </div>
        <div>
          <span>Conformes</span>
          <strong className="texto-conforme">{n.conformes}</strong>
        </div>
        <div>
          <span>Parcialmente conformes</span>
          <strong>{n.parciais}</strong>
        </div>
        <div>
          <span>Não conformes</span>
          <strong className="texto-nc">{n.nc}</strong>
        </div>
        <div>
          <span>Não se aplica</span>
          <strong>{n.na}</strong>
        </div>
        <div>
          <span>Requer verificação da CDE</span>
          <strong className={n.verificar ? 'texto-alerta' : ''}>{n.verificar}</strong>
        </div>
      </div>

      <p className="pequeno texto-muted" style={{ margin: 0 }}>
        Altere a situação direto na tabela. Os documentos marcados <span className="chip chip--azul">por turma</span> são avaliados em cada turma
        {comTurmas ? ` (${turmas.length} turmas em ${ano})` : carregando ? '' : ' — esta unidade não tem turmas no panorama, então valem para a unidade inteira'}; a
        situação deles resulta das turmas.
      </p>

      {n.verificar > 0 && (
        <p className="situacao-docs__aviso">
          <ShieldAlert size={16} aria-hidden /> {n.verificar} documento(s) foram declarados pela secretaria escolar sem comprovação (ou divergem da
          avaliação da CDE). Confira na visita e confirme ou corrija a situação.
        </p>
      )}
      {n.verificados > 0 && (
        <p className="pequeno texto-muted" style={{ margin: 0 }}>
          <BadgeCheck size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> {n.verificados} declaração(ões) da secretaria já verificada(s) pela CDE.
        </p>
      )}

      <div className="pilulas" role="group" aria-label="Filtrar documentos">
        {(Object.keys(filtros) as Filtro[]).map((k) => (
          <button type="button" key={k} className="pilula" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>
            {filtros[k][0]} <b>{filtros[k][1]}</b>
          </button>
        ))}
      </div>

      <div className="tabela-wrap">
        <table className="tabela tabela--compacta situacao-docs__tabela">
          <thead>
            <tr>
              <th>Documento</th>
              <th>Situação</th>
              <th>Verificação</th>
              <th>Secretaria declarou</th>
              <th className="num">PDFs</th>
            </tr>
          </thead>
          {SECOES.map((secao) => {
            const ls = linhas.filter((l) => l.def.secao === secao && visivel(l));
            if (!ls.length) return null;
            return (
              <tbody key={secao}>
                <tr className="secao-linha">
                  <td colSpan={5}>
                    {secao.split('.')[0]}. {SECOES_CURTAS[secao]}
                  </td>
                </tr>
                {ls.map((l) => {
                  const pdfs = anexosPorItem.get(chaveAvaliacao(l.auditoria_id, l.item)) ?? 0;
                  const turmaItem = porTurma(l);
                  const expandido = aberto === l.item;
                  const regs = turmaItem ? turmasDo(l) : [];
                  return (
                    <Fragment key={l.item}>
                      <tr>
                        <td>
                          <Link to={`/auditoria-documental/${aud.id}#item-${l.item}`} className="situacao-docs__item">
                            <span className="item-aud__codigo">{l.item}</span> {l.def.item}
                          </Link>
                          {ehPorTurma(l.item) && comTurmas && <span className="chip chip--azul situacao-docs__por-turma">por turma</span>}
                        </td>
                        <td>
                          {turmaItem ? (
                            <button
                              type="button"
                              className="situacao-docs__turmas"
                              aria-expanded={expandido}
                              onClick={() => setAberto(expandido ? null : l.item)}
                              title="Avaliar turma a turma"
                            >
                              <Etiqueta valor={l.situacao} />
                              <span className="pequeno">
                                {regs.filter((r) => avaliado(r.situacao)).length}/{turmas.length} turmas
                              </span>
                              {expandido ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
                            </button>
                          ) : (
                            <SeletorSituacao valor={l.situacao} aoMudar={(s) => salvar(comVerificacao(registro(l), s))} rotulo={`Situação de ${l.item}`} />
                          )}
                        </td>
                        <td>
                          <span className="situacao-docs__verif">
                            {verificacao(l)}
                            {l.verificacao === VERIFICACAO_PENDENTE && !turmaItem && (
                              <button
                                type="button"
                                className="grade-turmas__confirmar"
                                title="Conferido: a situação declarada está certa"
                                onClick={() => salvar({ ...registro(l), verificacao: VERIFICACAO_FEITA })}
                              >
                                <Check size={12} aria-hidden /> confirmar
                              </button>
                            )}
                          </span>
                        </td>
                        <td title={l.declaracao || undefined}>{l.declarado ? <Etiqueta valor={l.declarado} /> : <span className="texto-muted">—</span>}</td>
                        <td className="num">{pdfs || <span className="texto-muted">—</span>}</td>
                      </tr>
                      {turmaItem && expandido && (
                        <tr className="situacao-docs__grade">
                          <td colSpan={5}>
                            <GradeTurmas auditoriaId={aud.id} item={l.item} turmas={turmas} atual={registro(l)} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>
      {!linhas.some(visivel) && <p className="tabela-vazia">Nenhum documento neste filtro.</p>}
    </div>
  );
}
