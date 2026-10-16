import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowDownToLine, BadgeCheck, Check, Paperclip, ChevronDown, ChevronUp, ClipboardList, FilePlus2, Pencil, Printer, ShieldAlert } from 'lucide-react';
import { CLASSE_SITUACAO, CampoSelect, CampoTexto, Etiqueta, Faixa, Medidor, Nota } from '../components/ui';
import { Combobox } from '../components/Combobox';
import { Anexos, useQuantidadeAnexos } from '../components/Anexos';
import { FormAuditoria } from '../components/FormAuditoria';
import { FormAcao, acaoVazia, type RascunhoAcao } from '../components/FormAcao';
import {
  ROTULOS_AUDITORIA_DOC as R,
  ROTULOS_PLANO,
  SECOES,
  SECOES_CURTAS,
  SIM_NAO,
  SITUACOES_ACAO,
  SITUACOES_ITEM,
  TEXTOS,
} from '../data/planilha';
import { useDados } from '../lib/store';
import { avaliado, linhasDaAuditoria, type Linha } from '../lib/calc';
import { formatarData, formatarPct, formatarPeso } from '../lib/format';
import { avisar } from '../lib/avisos';
import { ROTULO_VERIFICACAO, VERIFICACAO_FEITA, VERIFICACAO_PENDENTE, divergeDaDeclaracao, ehPorTurma } from '../lib/checklist';
import { useTurmasDaAuditoria } from '../lib/useTurmas';
import type { Turma } from '../lib/panorama';
import { GradeTurmas } from '../components/AvaliacaoTurmas';
import { chaveAvaliacao, type Acao, type Auditoria, type Avaliacao, type SituacaoItem } from '../lib/types';

type Filtro = 'todos' | 'pendentes' | 'nc' | 'acao' | 'verificar';

/** O registro gravado do item (sem os campos calculados), com todos os campos, inclusive os da checklist da secretaria. */
function semDef(l: Linha): Avaliacao {
  const { def: _def, pesoAplicavel: _pa, pontos: _pontos, indice: _indice, ...av } = l;
  return av;
}

function precisaDetalhe(l: Linha) {
  return (
    l.situacao === 'Não conforme' ||
    l.situacao === 'Parcialmente conforme' ||
    l.situacao === 'Não se aplica' ||
    !!(l.evidencia || l.achado || l.responsavel || l.prazo)
  );
}

function ItemAuditoria({
  linha,
  turmas,
  acoes,
  aoSalvar,
  aoRegistrarAcao,
  aoConforme,
}: {
  linha: Linha;
  /** Turmas da unidade: os documentos da turma são avaliados turma a turma. */
  turmas: Turma[];
  acoes: Acao[];
  aoSalvar: (av: Avaliacao) => Promise<void>;
  aoRegistrarAcao: (l: Linha) => void;
  /** Chamado depois de gravar "Conforme" (permite avançar para o próximo item). */
  aoConforme?: (codigo: string) => void;
}) {
  const porTurma = turmas.length > 0 && ehPorTurma(linha.item);
  const [aberto, setAberto] = useState(() => precisaDetalhe(linha));
  const [texto, setTexto] = useState({ evidencia: linha.evidencia, achado: linha.achado, responsavel: linha.responsavel });
  const [salvo, setSalvo] = useState(false);
  const atual = useRef<Avaliacao>(semDef(linha));
  const temporizador = useRef<number>(0);

  // Sincroniza apenas quando os valores gravados deste item mudam (não a cada salvamento de outro item).
  const assinatura = JSON.stringify(semDef(linha));
  useEffect(() => {
    const gravado = JSON.parse(assinatura) as Avaliacao;
    atual.current = gravado;
    setTexto({ evidencia: gravado.evidencia, achado: gravado.achado, responsavel: gravado.responsavel });
  }, [assinatura]);

  async function salvar(mudancas: Partial<Avaliacao>) {
    window.clearTimeout(temporizador.current);
    const novo = { ...atual.current, ...mudancas };
    const mudou = (Object.keys(mudancas) as (keyof Avaliacao)[]).some((k) => atual.current[k] !== novo[k]);
    if (!mudou) return;
    atual.current = novo;
    await aoSalvar(novo);
    setSalvo(true);
    window.setTimeout(() => setSalvo(false), 1800);
  }

  function digitar(campo: 'evidencia' | 'achado' | 'responsavel', valor: string) {
    setTexto((t) => ({ ...t, [campo]: valor }));
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => void salvar({ [campo]: valor }), 1200);
  }

  useEffect(() => () => window.clearTimeout(temporizador.current), []);

  const def = linha.def;
  const nAnexos = useQuantidadeAnexos('avaliacao', chaveAvaliacao(linha.auditoria_id, linha.item));
  const criterioNA = TEXTOS.instrucoes.criterios.find((c) => c.situacao === 'Não se aplica');
  const id = `item-${linha.item}`;

  return (
    <article className="item-aud" id={id} aria-labelledby={id + '-t'}>
      <div className="item-aud__cab">
        <span className="item-aud__codigo">{linha.item}</span>
        <div className="item-aud__titulo">
          <strong id={id + '-t'}>{def.item}</strong>
          <span>
            {R.evidenciaEsperada}: {def.evidencia}
          </span>
        </div>
        <div className="item-aud__metricas" aria-label="Pontuação">
          <span>
            {R.peso} <b>{formatarPeso(def.peso)}</b>
          </span>
          <span>
            {R.pontos}{' '}
            <b>
              {formatarPeso(linha.pontos)}/{formatarPeso(linha.pesoAplicavel)}
            </b>
          </span>
          <span>
            {R.indiceItem} <b>{formatarPct(linha.indice)}</b>
          </span>
        </div>
      </div>

      <div className="item-aud__linha">
        {porTurma ? (
          <span className="item-aud__derivada">
            <Etiqueta valor={linha.situacao} /> <span className="pequeno texto-muted">resultado das {turmas.length} turmas (avalie abaixo)</span>
          </span>
        ) : (
          <div className="seg" role="group" aria-label={`${R.situacao} — ${linha.item}`}>
            {SITUACOES_ITEM.map((s) => (
              <button
                type="button"
                key={s}
                className={CLASSE_SITUACAO[s]}
                aria-pressed={linha.situacao === s}
                onClick={() => {
                  // Escolher a situação de um item autodeclarado é a verificação da CDE.
                  const verificar = linha.verificacao === VERIFICACAO_PENDENTE ? { verificacao: VERIFICACAO_FEITA } : {};
                  void salvar({ situacao: s as SituacaoItem, ...verificar }).then(() => {
                    if (s === 'Conforme') aoConforme?.(linha.item);
                  });
                  if (s === 'Não conforme' || s === 'Parcialmente conforme' || s === 'Não se aplica') setAberto(true);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
          {salvo && (
            <span className="salvo" role="status">
              <Check size={14} aria-hidden /> Salvo
            </span>
          )}
          {linha.verificacao === VERIFICACAO_FEITA && (
            <span className="chip chip--conforme" title={linha.declaracao}>
              <BadgeCheck size={12} aria-hidden /> {ROTULO_VERIFICACAO[VERIFICACAO_FEITA]}
            </span>
          )}
          {nAnexos > 0 && (
            <span className="chip chip--azul" title="PDFs anexados a este item">
              <Paperclip size={12} aria-hidden /> {nAnexos}
            </span>
          )}
          {acoes.map((a) => (
            <Link key={a.id} to={`/plano-de-acao?acao=${a.id}`} className="chip chip--azul" title={a.acao}>
              {a.id} · {a.situacao || '—'}
            </Link>
          ))}
          <button
            type="button"
            className="btn btn--neutro btn--pequeno"
            onClick={() => setAberto((x) => !x)}
            aria-expanded={aberto}
            aria-controls={id + '-det'}
          >
            {aberto ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />} Detalhes
          </button>
        </span>
      </div>

      {porTurma && (
        <div className="nao-imprimir">
          <GradeTurmas auditoriaId={linha.auditoria_id} item={linha.item} turmas={turmas} atual={semDef(linha)} />
        </div>
      )}

      {linha.verificacao === VERIFICACAO_PENDENTE && (
        <div className="nota nota--alerta verificacao" role="note">
          <ShieldAlert size={18} aria-hidden />
          <div>
            <strong>Autodeclarado pela secretaria escolar: requer verificação da CDE.</strong> {linha.declaracao}
            {porTurma ? (
              <div className="verificacao__acoes pequeno texto-muted">Confirme ou corrija cada turma marcada como autodeclarada acima.</div>
            ) : (
              <div className="verificacao__acoes nao-imprimir">
                <button type="button" className="btn btn--verde btn--pequeno" onClick={() => void salvar({ verificacao: VERIFICACAO_FEITA })}>
                  <BadgeCheck size={14} aria-hidden /> Confirmar {linha.situacao}
                </button>
                <span className="pequeno texto-muted">ou escolha outra situação acima, depois de conferir os documentos.</span>
              </div>
            )}
          </div>
        </div>
      )}
      {!porTurma && divergeDaDeclaracao(linha) && (
        <Nota tipo="alerta">
          <strong>A secretaria declarou {linha.declarado}</strong>, diferente da avaliação da CDE. {linha.declaracao}
        </Nota>
      )}

      {linha.situacao === 'Não se aplica' && !texto.achado.trim() && criterioNA && (
        <Nota tipo="alerta">
          <strong>{criterioNA.situacao}:</strong> {criterioNA.encaminhamento} ({R.achado})
        </Nota>
      )}

      {aberto && (
        <div id={id + '-det'} style={{ display: 'grid', gap: 10 }}>
          <p className="item-aud__orientacao">
            <strong>{TEXTOS.listaMestra.cabecalhos.orientacao}:</strong> {def.orientacao}
          </p>
          <div className="item-aud__detalhes">
            <div className="campo campo--largo">
              <label htmlFor={id + '-ev'}>{R.evidencia}</label>
              <textarea
                id={id + '-ev'}
                value={texto.evidencia}
                onChange={(e) => digitar('evidencia', e.target.value)}
                onBlur={() => void salvar({ evidencia: texto.evidencia })}
                rows={2}
              />
            </div>
            <div className="campo campo--largo">
              <label htmlFor={id + '-ac'}>{R.achado}</label>
              <textarea
                id={id + '-ac'}
                value={texto.achado}
                onChange={(e) => digitar('achado', e.target.value)}
                onBlur={() => void salvar({ achado: texto.achado })}
                rows={2}
              />
            </div>
            <CampoSelect
              rotulo={R.requerAcao}
              valor={linha.requer_acao}
              aoMudar={(v) => void salvar({ requer_acao: v })}
              opcoes={SIM_NAO}
              vazio={false}
            />
            <CampoTexto rotulo={R.prazo} tipo="date" valor={linha.prazo} aoMudar={(v) => void salvar({ prazo: v })} />
            <div className="campo">
              <label htmlFor={id + '-resp'}>{R.responsavel}</label>
              <input
                id={id + '-resp'}
                value={texto.responsavel}
                onChange={(e) => digitar('responsavel', e.target.value)}
                onBlur={() => void salvar({ responsavel: texto.responsavel })}
              />
            </div>
            <CampoSelect
              rotulo={R.situacaoAcao}
              valor={linha.situacao_acao}
              aoMudar={(v) => void salvar({ situacao_acao: v })}
              opcoes={SITUACOES_ACAO}
            />
            <div className="campo--largo">
              <Anexos entidade="avaliacao" entidadeId={chaveAvaliacao(linha.auditoria_id, linha.item)} />
            </div>
            <div className="campo--largo" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn--contorno btn--pequeno" onClick={() => aoRegistrarAcao(linha)}>
                <FilePlus2 size={14} aria-hidden /> Registrar no Plano de Ação
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function SeletorAuditoria({ atual }: { atual?: string }) {
  const d = useDados();
  const navegar = useNavigate();
  const opcoes = useMemo(
    () =>
      d.auditorias.map((a) => {
        const u = d.unidadePorId.get(a.unidade_id);
        return {
          valor: a.id,
          rotulo: `${a.id} — ${u?.nome ?? ''}`,
          detalhe: [u?.distrito, u?.bairro, a.situacao, a.tipo].filter(Boolean).join(' · '),
        };
      }),
    [d.auditorias, d.unidadePorId],
  );
  return (
    <Combobox
      rotulo={`${R.id} / ${R.unidade}`}
      opcoes={opcoes}
      valor={atual ?? ''}
      aoMudar={(v) => v && navegar(`/auditoria-documental/${v}`)}
      obrigatorio
    />
  );
}

export function AuditoriaDocumental() {
  const { id } = useParams();
  const d = useDados();
  const aud = id ? d.auditoriaPorId.get(id) : undefined;
  const t = TEXTOS.auditoriaDocumental;
  const passo = TEXTOS.instrucoes.passos[2];

  if (!aud) {
    const recentes = d.auditorias
      .filter((a) => a.iniciada || a.situacao === 'Em execução' || a.situacao === 'Agendada')
      .slice(0, 12);
    return (
      <>
        <Faixa titulo={t.titulo} sub={t.subtitulo} />
        <div className="container pagina">
          <Nota>
            <strong>{passo.titulo}.</strong> {passo.descricao}
          </Nota>
          <section className="cartao">
            <div className="cartao__corpo" style={{ display: 'grid', gap: 16 }}>
              <SeletorAuditoria />
              {id && <Nota tipo="alerta">{`${R.id} ${id} não encontrado.`}</Nota>}
            </div>
            {recentes.length > 0 && (
              <ul className="lista-simples" style={{ borderTop: '1px solid var(--borda)' }}>
                {recentes.map((a) => {
                  const s = d.resumos.get(a.id);
                  return (
                    <li key={a.id}>
                      <div>
                        <Link to={`/auditoria-documental/${a.id}`}>
                          {a.id} · {d.unidadePorId.get(a.unidade_id)?.nome}
                        </Link>
                        <div className="pequeno texto-muted">
                          {ROTULOS_PLANO.avaliados}: {s?.avaliados ?? 0}/{s?.previstos ?? 0}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <Etiqueta valor={a.situacao} />
                        <Medidor valor={s?.indice ?? null} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </>
    );
  }

  return <PainelAuditoria aud={aud} />;
}

function PainelAuditoria({ aud }: { aud: Auditoria }) {
  const d = useDados();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [editando, setEditando] = useState(false);
  const [novaAcao, setNovaAcao] = useState<RascunhoAcao | null>(null);
  const [avancar, setAvancar] = useState(() => {
    try {
      return localStorage.getItem('instrumento-cde:avancar') === '1';
    } catch {
      return false;
    }
  });
  const t = TEXTOS.auditoriaDocumental;
  const u = d.unidadePorId.get(aud.unidade_id);
  const { hash } = useLocation();
  // Link para um item (#item-INS-01, vindo da página da unidade): rola até ele.
  useEffect(() => {
    if (!hash.startsWith('#item-')) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    el?.scrollIntoView({ block: 'center' });
    el?.classList.add('item-aud--destaque');
    const t = window.setTimeout(() => el?.classList.remove('item-aud--destaque'), 2500);
    return () => window.clearTimeout(t);
  }, [hash, aud.id]);
  const linhas = useMemo(() => linhasDaAuditoria(aud.id, d.mapaAvaliacoes), [aud.id, d.mapaAvaliacoes]);
  const { turmas } = useTurmasDaAuditoria(aud);
  const resumo = d.resumos.get(aud.id);
  const acoesPorItem = useMemo(() => {
    const m = new Map<string, Acao[]>();
    for (const a of d.acoes) if (a.auditoria_id === aud.id) m.set(a.item, [...(m.get(a.item) ?? []), a]);
    return m;
  }, [d.acoes, aud.id]);

  const visiveis = linhas.filter((l) => {
    if (filtro === 'pendentes') return !avaliado(l.situacao);
    if (filtro === 'nc') return l.situacao === 'Não conforme' || l.situacao === 'Parcialmente conforme';
    if (filtro === 'acao') return l.requer_acao === 'Sim';
    if (filtro === 'verificar') return l.verificacao === VERIFICACAO_PENDENTE || divergeDaDeclaracao(l);
    return true;
  });
  const contagens = {
    todos: linhas.length,
    pendentes: linhas.filter((l) => !avaliado(l.situacao)).length,
    nc: linhas.filter((l) => l.situacao === 'Não conforme' || l.situacao === 'Parcialmente conforme').length,
    acao: linhas.filter((l) => l.requer_acao === 'Sim').length,
    verificar: linhas.filter((l) => l.verificacao === VERIFICACAO_PENDENTE || divergeDaDeclaracao(l)).length,
  };
  const rotulosFiltro: Record<Filtro, string> = {
    todos: 'Todos',
    pendentes: 'Não avaliado',
    nc: 'Não conforme / Parcialmente conforme',
    acao: `${R.requerAcao} Sim`,
    verificar: 'Requer verificação da CDE',
  };

  function alternarAvancar(v: boolean) {
    setAvancar(v);
    try {
      localStorage.setItem('instrumento-cde:avancar', v ? '1' : '0');
    } catch {
      /* preferência opcional */
    }
  }

  /** Rola até o primeiro item ainda não avaliado depois de `depoisDe` (ou o primeiro de todos). */
  function irParaPendente(depoisDe?: string) {
    const lista = linhas.filter((l) => !avaliado(l.situacao) && l.item !== depoisDe);
    const base = depoisDe ? linhas.findIndex((l) => l.item === depoisDe) : -1;
    const alvo = lista.find((l) => linhas.findIndex((x) => x.item === l.item) > base) ?? lista[0];
    if (!alvo) {
      avisar('Todos os itens já foram avaliados.');
      return;
    }
    const el = document.getElementById(`item-${alvo.item}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.querySelector<HTMLButtonElement>('.seg button')?.focus({ preventScroll: true });
  }

  function registrarAcao(l: Linha) {
    setNovaAcao({
      ...acaoVazia(),
      auditoria_id: aud.id,
      unidade_id: aud.unidade_id,
      item: l.item,
      achado: l.achado,
      responsavel: l.responsavel,
      prazo: l.prazo,
    });
  }

  const dataAud = aud.data_realizada || aud.data_planejada;
  const r = ROTULOS_PLANO;

  return (
    <>
      <Faixa bruto sobre={`Auditoria Documental · ${aud.id}`} titulo={u?.nome ?? aud.id} sub={t.subtitulo}>
        <Link to={`/checklist-da-visita/${aud.id}`} className="btn btn--claro">
          <ClipboardList size={16} aria-hidden /> Checklist da Visita
        </Link>
        <button type="button" className="btn btn--claro" onClick={() => setEditando(true)}>
          <Pencil size={16} aria-hidden /> Plano de Visita Técnica
        </button>
        <button type="button" className="btn btn--claro" onClick={() => window.print()}>
          <Printer size={16} aria-hidden /> Imprimir
        </button>
      </Faixa>

      <div className="container pagina">
        <section className="cartao">
          <div className="cartao__corpo" style={{ display: 'grid', gap: 18 }}>
            <div className="nao-imprimir" style={{ maxWidth: 720 }}>
              <SeletorAuditoria atual={aud.id} />
            </div>
            <dl className="definicoes" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              <div>
                <dt>{R.id}</dt>
                <dd className="forte">{aud.id}</dd>
              </div>
              <div>
                <dt>{R.data}</dt>
                <dd>{formatarData(dataAud) || '—'}</dd>
              </div>
              <div>
                <dt>{R.distrito}</dt>
                <dd>{u?.distrito || '—'}</dd>
              </div>
              <div>
                <dt>{R.bairro}</dt>
                <dd>{u?.bairro || '—'}</dd>
              </div>
              <div>
                <dt>{R.auditor}</dt>
                <dd>{aud.equipe || '—'}</dd>
              </div>
              <div>
                <dt>{r.tipo}</dt>
                <dd>{aud.tipo || '—'}</dd>
              </div>
              <div>
                <dt>{r.situacao}</dt>
                <dd>
                  <Etiqueta valor={aud.situacao} />
                </dd>
              </div>
            </dl>
            <dl className="resumo-aud">
              <div>
                <dt>{r.previstos}</dt>
                <dd>{resumo?.iniciada ? resumo.previstos : 0}</dd>
              </div>
              <div>
                <dt>{r.avaliados}</dt>
                <dd>{resumo?.avaliados ?? 0}</dd>
              </div>
              <div>
                <dt>{r.indice}</dt>
                <dd>{formatarPct(resumo?.indice ?? null)}</dd>
              </div>
              <div>
                <dt>{r.ncCriticas}</dt>
                <dd>{resumo?.ncCriticas ?? 0}</dd>
              </div>
              <div>
                <dt>{r.checklist}</dt>
                <dd>{formatarPct(resumo?.checklist ?? null)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <details className="cartao nao-imprimir doc-auditoria">
          <summary>
            <Paperclip size={16} aria-hidden /> Documentos da auditoria (relatório, comprovantes)
          </summary>
          <div className="cartao__corpo">
            <Anexos entidade="auditoria" entidadeId={aud.id} />
          </div>
        </details>

        <div className="aud-barra nao-imprimir" role="region" aria-label={`${R.id} ${aud.id}`}>
          <div className="aud-barra__prog">
            <span className="aud-barra__texto">
              <strong>{resumo?.avaliados ?? 0}</strong>/{resumo?.iniciada ? resumo.previstos : linhas.length} {r.avaliados}
            </span>
            <span className="medidor__trilho" aria-hidden>
              <span
                className="medidor__barra"
                style={{ display: 'block', width: `${((resumo?.avaliados ?? 0) / Math.max(1, linhas.length)) * 100}%` }}
              />
            </span>
            <span className="aud-barra__texto">
              {r.indice}: <strong>{formatarPct(resumo?.indice ?? null)}</strong>
            </span>
          </div>
          <div className="aud-barra__acoes">
            <label className="aud-barra__opcao">
              <input type="checkbox" checked={avancar} onChange={(e) => alternarAvancar(e.target.checked)} />
              Ir ao próximo item ao marcar Conforme
            </label>
            <button
              type="button"
              className="btn btn--primario btn--pequeno"
              onClick={() => irParaPendente()}
              disabled={contagens.pendentes === 0}
            >
              <ArrowDownToLine size={14} aria-hidden /> Próximo não avaliado
            </button>
          </div>
        </div>

        {contagens.verificar > 0 && (
          <Nota tipo="alerta">
            <strong>{contagens.verificar} item(ns) da checklist da secretaria escolar requerem verificação da CDE.</strong> A situação declarada
            pela secretaria já entra no índice, mas foi entregue sem comprovação: confira os documentos e confirme ou corrija cada item.{' '}
            <button type="button" className="link-botao" onClick={() => setFiltro('verificar')}>
              Mostrar só esses itens
            </button>
          </Nota>
        )}

        <Nota>
          <strong>{TEXTOS.instrucoes.passos[2].titulo}.</strong> {TEXTOS.instrucoes.passos[2].descricao}{' '}
          {TEXTOS.instrucoes.passos[3].descricao}
        </Nota>

        <div className="pilulas nao-imprimir" role="group" aria-label="Filtrar itens">
          {(Object.keys(rotulosFiltro) as Filtro[]).filter((k) => k !== 'verificar' || contagens.verificar > 0).map((k) => (
            <button type="button" key={k} className="pilula" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>
              {rotulosFiltro[k]} <b>{contagens[k]}</b>
            </button>
          ))}
        </div>

        <div className="aud-layout">
          <nav className="aud-indice" aria-label={R.secao}>
            {SECOES.map((s) => {
              const ls = linhas.filter((l) => l.def.secao === s);
              const n = ls.filter((l) => avaliado(l.situacao)).length;
              return (
                <a key={s} href={`#secao-${s.split('.')[0]}`}>
                  <span>
                    {s.split('.')[0]}. {SECOES_CURTAS[s]}
                  </span>
                  <small>
                    {n}/{ls.length}
                  </small>
                </a>
              );
            })}
          </nav>
          <div style={{ display: 'grid', gap: 20, minWidth: 0 }}>
            {SECOES.map((s) => {
              const ls = visiveis.filter((l) => l.def.secao === s);
              if (ls.length === 0) return null;
              const todas = linhas.filter((l) => l.def.secao === s);
              const m = todas.reduce((x, l) => x + l.pesoAplicavel, 0);
              const n = todas.reduce((x, l) => x + l.pontos, 0);
              return (
                <section className="cartao" key={s} id={`secao-${s.split('.')[0]}`} style={{ scrollMarginTop: 70 }}>
                  <div className="cartao__cab">
                    <h2 className="titulo-bloco">{s}</h2>
                    <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span className="contagem">
                        {todas.filter((l) => avaliado(l.situacao)).length}/{todas.length}
                      </span>
                      <Medidor valor={m === 0 ? null : n / m} />
                    </span>
                  </div>
                  {ls.map((l) => (
                    <ItemAuditoria
                      key={l.item}
                      linha={l}
                      turmas={turmas}
                      acoes={acoesPorItem.get(l.item) ?? []}
                      aoSalvar={d.salvarAvaliacao}
                      aoRegistrarAcao={registrarAcao}
                      aoConforme={avancar ? (codigo) => irParaPendente(codigo) : undefined}
                    />
                  ))}
                </section>
              );
            })}
            {visiveis.length === 0 && <p className="tabela-vazia">Nenhum item neste filtro.</p>}
          </div>
        </div>
      </div>

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
      {novaAcao && (
        <FormAcao
          inicial={novaAcao}
          aoFechar={() => setNovaAcao(null)}
          aoSalvar={async (a) => {
            const novoId = await d.criarAcao(a);
            const linha = linhas.find((l) => l.item === a.item);
            if (linha && (linha.requer_acao !== 'Sim' || !linha.situacao_acao)) {
              await d.salvarAvaliacao({
                ...semDef(linha),
                requer_acao: 'Sim',
                situacao_acao: linha.situacao_acao || a.situacao,
                prazo: linha.prazo || a.prazo,
                responsavel: linha.responsavel || a.responsavel,
              });
            }
            avisar(`Ação ${novoId} registrada no Plano de Ação.`);
          }}
        />
      )}
    </>
  );
}
