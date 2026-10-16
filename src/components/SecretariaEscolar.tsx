import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Download, FileSpreadsheet, FileUp, School, TriangleAlert, Users } from 'lucide-react';
import { avisar } from '../lib/avisos';
import { baixar } from '../lib/exportar';
import { formatarData, formatarNumero, formatarPct, hojeISO } from '../lib/format';
import { useDados } from '../lib/store';
import {
  ITENS_CHECKLIST,
  auditoriaDeReferencia,
  consolidar,
  pendentesDaTurma,
  planejarAplicacao,
  registrosDaAplicacao,
  respostasComDados,
  resumirChecklist,
  type ChecklistUnidade,
  type MudancaItem,
} from '../lib/checklist';
import { diferencasCadastro, gerarChecklistExcel, lerChecklistExcel, type ChecklistLida, type DiferencaCadastro } from '../lib/checklistExcel';
import { agruparTurmas, compararAnos, decodificarTurma, resumirTurmas, semelhanca, type UnidadePanorama } from '../lib/panorama';
import type { Unidade } from '../lib/types';
import { Etiqueta, Nota, Vazio } from './ui';

const TIPO_AUTOAVALIACAO = 'Autoavaliação da unidade';
const NOVA = '__nova__';

interface Estado {
  carregando: boolean;
  /** A unidade no panorama do ano (undefined quando não aparece nele). */
  atual?: UnidadePanorama;
  anterior?: UnidadePanorama;
  checklist: ChecklistUnidade | null;
}

/**
 * Fim da página da unidade: a checklist da secretaria escolar (gerar, enviar e aplicar na auditoria) e as turmas do ano,
 * do Panorama de Matrícula.
 */
export function SecretariaEscolar({ unidade }: { unidade: Unidade }) {
  const d = useDados();
  const anos = d.panoramas.map((p) => p.ano);
  const [ano, setAno] = useState<number | null>(null);
  const anoAtual = ano ?? anos[0] ?? new Date().getFullYear();
  const [estado, setEstado] = useState<Estado>({ carregando: true, checklist: null });

  const carregar = useCallback(async () => {
    setEstado((e) => ({ ...e, carregando: true }));
    const naUnidade = (p: Awaited<ReturnType<typeof d.obterPanorama>>) => p?.unidades.find((x) => x.unidade_id === unidade.id);
    try {
      const anteriorAno = anos.filter((a) => a < anoAtual)[0];
      const [p, pa, checklist] = await Promise.all([
        d.obterPanorama(anoAtual),
        anteriorAno ? d.obterPanorama(anteriorAno) : Promise.resolve(null),
        d.obterChecklist(unidade.id, anoAtual).catch(() => null),
      ]);
      setEstado({ carregando: false, atual: naUnidade(p), anterior: naUnidade(pa), checklist });
    } catch (e) {
      avisar('Não foi possível carregar as turmas: ' + (e as Error).message, 'erro');
      setEstado({ carregando: false, checklist: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidade.id, anoAtual, anos.join(','), d.obterPanorama, d.obterChecklist]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const seletorAno =
    anos.length > 1 ? (
      <label className="seletor-ano">
        <span>Ano</span>
        <select value={anoAtual} onChange={(e) => setAno(Number(e.target.value))}>
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
    ) : (
      <span className="chip chip--azul">{anoAtual}</span>
    );

  return (
    <>
      <section className="cartao" aria-labelledby="checklist-secretaria">
        <div className="cartao__cab">
          <h2 id="checklist-secretaria" className="titulo-bloco">
            Checklist da secretaria escolar
          </h2>
          {seletorAno}
        </div>
        <div className="cartao__corpo">
          <ChecklistSecretaria unidade={unidade} ano={anoAtual} estado={estado} aoSalvar={carregar} />
        </div>
      </section>

      <section className="cartao" aria-labelledby="turmas-unidade">
        <div className="cartao__cab">
          <h2 id="turmas-unidade" className="titulo-bloco">
            Turmas
          </h2>
          <span className="contagem">Panorama de Matrícula (SIGA) · {anoAtual}</span>
        </div>
        <div className="cartao__corpo">
          <TurmasUnidade ano={anoAtual} anos={anos} estado={estado} />
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------- checklist

interface Previa {
  arquivo: string;
  lida: ChecklistLida;
  /** Campos da aba Unidade diferentes do Cadastro. */
  cadastro: DiferencaCadastro[];
  outraUnidade: boolean;
  foraDoPanorama: string[];
  semAba: string[];
}

function ChecklistSecretaria({ unidade, ano, estado, aoSalvar }: { unidade: Unidade; ano: number; estado: Estado; aoSalvar: () => Promise<void> }) {
  const d = useDados();
  const entrada = useRef<HTMLInputElement>(null);
  const [gerando, setGerando] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [confirmaUnidade, setConfirmaUnidade] = useState(false);
  /** Campos do Cadastro marcados para atualizar. */
  const [camposMarcados, setCamposMarcados] = useState<Set<string>>(new Set());
  const turmas = estado.atual?.turmas ?? [];
  const c = estado.checklist;

  const auditorias = useMemo(() => d.auditorias.filter((a) => a.unidade_id === unidade.id).sort((a, b) => b.id.localeCompare(a.id)), [d.auditorias, unidade.id]);
  const abertas = auditorias.filter((a) => a.situacao !== 'Concluída' && a.situacao !== 'Cancelada');
  const [destino, setDestino] = useState('');
  const auditoriaDestino = destino || abertas[0]?.id || NOVA;

  /** Em branco: tudo "Não avaliado". Com dados: a avaliação da CDE e, onde ela não avaliou, as respostas da secretaria. */
  async function gerar(comDados: boolean) {
    setGerando(true);
    try {
      const codigos = turmas.length ? turmas.map((t) => t.turma) : ['GERAL'];
      const ref = auditoriaDeReferencia(d.auditorias, unidade.id);
      const respostas = comDados ? respostasComDados(codigos, c?.turmas, ref && d.mapaAvaliacoes.get(ref.id)) : undefined;
      const { buffer, nome } = await gerarChecklistExcel({ unidade, ano, turmas, panorama: estado.atual, respostas });
      baixar(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), comDados ? nome : nome.replace(/\.xlsx$/, '_em_branco.xlsx'));
      avisar(comDados ? 'Planilha gerada com a situação atual dos documentos.' : 'Planilha em branco gerada.');
    } catch (e) {
      avisar('Não foi possível gerar a planilha: ' + (e as Error).message, 'erro');
    } finally {
      setGerando(false);
    }
  }

  async function ler(f: File) {
    setLendo(true);
    setPrevia(null);
    setConfirmaUnidade(false);
    try {
      if (!/\.xlsx$/i.test(f.name)) throw new Error('envie um arquivo do Excel (.xlsx).');
      const lida = await lerChecklistExcel(f);
      const inepDiferente = !!lida.unidade.inep && lida.unidade.inep !== unidade.inep.replace(/\D/g, '');
      const nomeDiferente = !!lida.unidade.nome && semelhanca(lida.unidade.nome, unidade.nome) < 0.8;
      const codigos = new Set(turmas.map((t) => t.turma));
      const cadastro = diferencasCadastro(unidade, lida.cadastro);
      setCamposMarcados(new Set(cadastro.map((x) => x.campo)));
      setPrevia({
        arquivo: f.name,
        lida,
        cadastro,
        // O anexo divide o INEP com a sede: só o nome diferente indica outra unidade.
        outraUnidade: nomeDiferente || (inepDiferente && !lida.unidade.nome),
        foraDoPanorama: Object.keys(lida.turmas).filter((t) => turmas.length && !codigos.has(t)),
        semAba: turmas.map((t) => t.turma).filter((t) => !(t in lida.turmas)),
      });
    } catch (e) {
      avisar('Não foi possível ler a checklist: ' + (e as Error).message, 'erro');
    } finally {
      setLendo(false);
      if (entrada.current) entrada.current.value = '';
    }
  }

  // Situação declarada de cada item, juntando as turmas (as do panorama sem aba contam como não avaliadas).
  const consolidados = useMemo(() => (previa ? consolidar({ turmas: previa.lida.turmas }, turmas.map((t) => t.turma)) : null), [previa, turmas]);
  const plano: MudancaItem[] = useMemo(() => {
    if (!consolidados || !previa) return [];
    const id = auditoriaDestino === NOVA ? 'NOVA' : auditoriaDestino;
    return planejarAplicacao(consolidados, id, d.mapaAvaliacoes.get(id), { ano, arquivo: previa.arquivo, data: hojeISO() });
  }, [consolidados, previa, auditoriaDestino, d.mapaAvaliacoes, ano]);
  const aplicar = plano.filter((m) => m.acao === 'aplicar');
  const divergentes = plano.filter((m) => m.diverge);

  async function salvar(naAuditoria: boolean) {
    if (!previa || !consolidados) return;
    setAplicando(true);
    try {
      await d.salvarChecklist({ unidade_id: unidade.id, ano, arquivo: previa.arquivo, turmas: previa.lida.turmas });
      let msg = 'Checklist salva.';
      const mudancasCadastro = previa.cadastro.filter((x) => camposMarcados.has(x.campo));
      if (mudancasCadastro.length) {
        await d.salvarUnidade({ ...unidade, ...Object.fromEntries(mudancasCadastro.map((x) => [x.campo, x.para])), data_atualizacao: hojeISO() });
      }
      if (naAuditoria) {
        let audId = auditoriaDestino;
        if (audId === NOVA) {
          audId = await d.criarAuditoria({
            unidade_id: unidade.id,
            tipo: TIPO_AUTOAVALIACAO,
            prioridade: '',
            data_planejada: '',
            data_realizada: '',
            equipe: '',
            situacao: 'Em execução',
            observacoes: `Criada a partir da checklist da secretaria escolar (${previa.arquivo}, ${formatarData(hojeISO())}).`,
            iniciada: true,
          });
        }
        // Recalcula contra a auditoria escolhida (ou recém-criada), com os dados atuais.
        const registros = registrosDaAplicacao(planejarAplicacao(consolidados, audId, d.mapaAvaliacoes.get(audId), { ano, arquivo: previa.arquivo, data: hojeISO() }));
        await d.salvarAvaliacoes(registros);
        msg = `Checklist salva e aplicada na auditoria ${audId}: ${aplicar.length} item(ns) aguardam verificação da CDE.`;
      }
      if (mudancasCadastro.length) msg += ` Cadastro atualizado (${mudancasCadastro.map((x) => x.rotulo).join(', ')}).`;
      avisar(msg);
      setPrevia(null);
      await aoSalvar();
    } catch (e) {
      avisar('Não foi possível salvar: ' + (e as Error).message, 'erro');
    } finally {
      setAplicando(false);
    }
  }

  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setArrastando(false);
    const f = e.dataTransfer.files[0];
    if (f) void ler(f);
  };

  const r = c ? resumirChecklist(c) : null;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <p className="texto-muted pequeno" style={{ margin: 0 }}>
        A planilha tem a identificação da unidade, as turmas de {ano} e uma aba de checklist por turma com os {ITENS_CHECKLIST.length} documentos das
        seções 1 a 5 da Lista Mestra. A secretaria preenche e devolve; o sistema lê as abas e leva a situação de cada documento para a auditoria,
        marcada como <strong>requer verificação da CDE</strong> (é uma autodeclaração, sem prova). O que a CDE já avaliou nunca é substituído.
      </p>

      <div className="checklist-status">
        <FileSpreadsheet size={22} aria-hidden />
        {estado.carregando ? (
          <span className="texto-muted">Carregando…</span>
        ) : c && r ? (
          <div>
            <strong>{c.arquivo}</strong>
            <span className="pequeno texto-muted">
              {' '}
              · enviada em {formatarData(c.atualizado_em.slice(0, 10))}
              {c.atualizado_por && ` por ${c.atualizado_por}`} · {r.turmas} turma(s) · {r.pendentes} pendência(s) declaradas
            </span>
          </div>
        ) : (
          <span className="texto-muted">Nenhuma checklist de {ano} foi enviada para esta unidade.</span>
        )}
      </div>

      <div className="checklist-acoes">
        <div className="checklist-acoes__gerar">
          <button
            type="button"
            className="btn btn--primario"
            disabled={gerando || estado.carregando}
            onClick={() => void gerar(true)}
            title="Com a situação atual de cada documento: o que a CDE avaliou e, onde ela ainda não avaliou, as últimas respostas da secretaria"
          >
            <Download size={16} aria-hidden /> {gerando ? 'Gerando…' : 'Gerar com dados'}
          </button>
          <button type="button" className="btn btn--contorno" disabled={gerando || estado.carregando} onClick={() => void gerar(false)} title="Todos os documentos como Não avaliado">
            <Download size={16} aria-hidden /> Gerar em branco
          </button>
        </div>
        <div
          className={'anexos__drop checklist-acoes__drop' + (arrastando ? ' anexos__drop--ativo' : '')}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={soltar}
        >
          <FileUp size={20} aria-hidden />
          <span>{c ? 'Atualize enviando a checklist preenchida' : 'Anexe a checklist preenchida'} (.xlsx) aqui ou</span>
          <button type="button" className="btn btn--verde btn--pequeno" disabled={lendo || aplicando} onClick={() => entrada.current?.click()}>
            {lendo ? 'Lendo…' : 'Escolher arquivo'}
          </button>
          <input ref={entrada} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => e.target.files?.[0] && void ler(e.target.files[0])} />
        </div>
      </div>
      {!estado.carregando && !turmas.length && (
        <Nota tipo="alerta">Esta unidade não está no Panorama de Matrícula de {ano}: a planilha sai com uma única aba de checklist (GERAL).</Nota>
      )}

      {previa && consolidados && (
        <div className="importacao">
          <strong>{previa.arquivo}</strong>
          {previa.outraUnidade && (
            <Nota tipo="alerta">
              <TriangleAlert size={14} aria-hidden /> A planilha parece ser de outra unidade: <strong>{previa.lida.unidade.nome || '(sem nome)'}</strong>
              {previa.lida.unidade.inep && ` (INEP ${previa.lida.unidade.inep})`}.
              <label style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input type="checkbox" checked={confirmaUnidade} onChange={(e) => setConfirmaUnidade(e.target.checked)} /> É desta unidade mesmo
              </label>
            </Nota>
          )}
          {previa.lida.ano > 0 && previa.lida.ano !== ano && (
            <Nota tipo="alerta">A planilha é de {previa.lida.ano}, mas será salva como a checklist de {ano} (o ano escolhido acima).</Nota>
          )}

          {previa.cadastro.length > 0 && (
            <fieldset className="checklist-cadastro">
              <legend>Dados da unidade diferentes do Cadastro (aba Unidade)</legend>
              <p className="pequeno texto-muted" style={{ margin: 0 }}>
                Os campos marcados atualizam o Cadastro ao salvar. Nome e INEP não mudam por aqui; células vazias não apagam nada.
              </p>
              {previa.cadastro.map((x) => (
                <label key={x.campo} className="checklist-cadastro__campo">
                  <input
                    type="checkbox"
                    checked={camposMarcados.has(x.campo)}
                    onChange={(e) =>
                      setCamposMarcados((m) => {
                        const n = new Set(m);
                        if (e.target.checked) n.add(x.campo);
                        else n.delete(x.campo);
                        return n;
                      })
                    }
                  />
                  <span>
                    <strong>{x.rotulo}:</strong> <s>{x.de || '(vazio)'}</s> → <b>{x.para}</b>
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          <dl className="definicoes" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            <div>
              <dt>Turmas lidas</dt>
              <dd>{Object.keys(previa.lida.turmas).length}</dd>
            </div>
            <div>
              <dt>Turmas no panorama</dt>
              <dd>{turmas.length || '—'}</dd>
            </div>
            <div>
              <dt>Itens a aplicar</dt>
              <dd>{aplicar.length}</dd>
            </div>
            <div>
              <dt>Diferem da CDE</dt>
              <dd>{divergentes.length}</dd>
            </div>
          </dl>
          {previa.semAba.length > 0 && (
            <p className="pequeno" style={{ margin: 0 }}>
              Turmas do panorama sem aba na planilha (contam como não avaliadas): {previa.semAba.join(', ')}.
            </p>
          )}
          {previa.foraDoPanorama.length > 0 && (
            <p className="pequeno" style={{ margin: 0 }}>
              Abas de turmas que não estão no panorama de {ano} (entram assim mesmo): {previa.foraDoPanorama.join(', ')}.
            </p>
          )}

          <div className="tabela-wrap">
            <table className="tabela tabela--compacta">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Declarado (todas as turmas)</th>
                  <th>Na auditoria hoje</th>
                  <th>O que acontece</th>
                </tr>
              </thead>
              <tbody>
                {plano.map((m) => (
                  <tr key={m.codigo}>
                    <td>
                      <span className="item-aud__codigo">{m.codigo}</span> {m.rotulo}
                    </td>
                    <td title={m.declarado.naoConformes.length ? `Não conforme: ${m.declarado.naoConformes.join(', ')}` : undefined}>
                      <Etiqueta valor={m.declarado.situacao} />{' '}
                      <span className="pequeno texto-muted">
                        {m.declarado.contagem.Conforme}/{m.declarado.turmas}
                      </span>
                    </td>
                    <td>
                      <Etiqueta valor={m.antes.situacao} />
                    </td>
                    <td className="pequeno">
                      {m.acao === 'aplicar' && <span className="chip chip--parcial">Entra · requer verificação</span>}
                      {m.acao === 'manter' && (m.diverge ? <span className="chip chip--nc">Mantém a avaliação da CDE (diverge)</span> : 'Mantém a avaliação da CDE')}
                      {m.acao === 'igual' && <span className="texto-muted">Sem mudança</span>}
                      {m.acao === 'sem-declaracao' && <span className="texto-muted">Não declarado</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {previa.lida.avisos.length > 0 && (
            <Nota tipo="alerta">
              <strong>{previa.lida.avisos.length} aviso(s) da leitura:</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {previa.lida.avisos.slice(0, 8).map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
                {previa.lida.avisos.length > 8 && <li>… e mais {previa.lida.avisos.length - 8}.</li>}
              </ul>
            </Nota>
          )}

          <div className="campo" style={{ maxWidth: 560 }}>
            <label htmlFor="checklist-destino">Aplicar na auditoria</label>
            <select id="checklist-destino" value={auditoriaDestino} onChange={(e) => setDestino(e.target.value)}>
              {auditorias.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id} · {a.tipo || 'sem tipo'} · {a.situacao || 'sem situação'}
                </option>
              ))}
              <option value={NOVA}>Nova auditoria ({TIPO_AUTOAVALIACAO})</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--verde" disabled={aplicando || (previa.outraUnidade && !confirmaUnidade)} onClick={() => void salvar(true)}>
              {aplicando ? 'Salvando…' : `Salvar e aplicar ${aplicar.length} item(ns) na auditoria`}
            </button>
            <button type="button" className="btn btn--contorno" disabled={aplicando || (previa.outraUnidade && !confirmaUnidade)} onClick={() => void salvar(false)}>
              Só salvar a checklist
            </button>
            <button type="button" className="btn btn--neutro" disabled={aplicando} onClick={() => setPrevia(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- turmas

const TURNO_CURTO: Record<string, string> = { MANHÃ: 'Manhã', TARDE: 'Tarde', NOITE: 'Noite', 'TEMPO INTEGRAL': 'Integral', INTERMEDIÁRIO: 'Intermediário' };

function TurmasUnidade({ ano, anos, estado }: { ano: number; anos: number[]; estado: Estado }) {
  const turmas = estado.atual?.turmas ?? [];
  const grupos = useMemo(() => agruparTurmas(turmas), [turmas]);
  if (estado.carregando) return <p className="texto-muted">Carregando turmas…</p>;
  if (!estado.atual) {
    return (
      <Vazio
        texto={
          anos.length
            ? `Esta unidade não aparece no Panorama de Matrícula de ${ano}.`
            : 'Nenhum Panorama de Matrícula disponível. O administrador envia o do ano em Dados e planilhas → Turmas.'
        }
      />
    );
  }

  const r = resumirTurmas(turmas);
  const anoAnterior = anos.filter((a) => a < ano)[0];
  const mudancas = estado.anterior ? compararAnos(turmas, estado.anterior.turmas) : null;
  const respostas = estado.checklist?.turmas;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="metricas metricas--compactas">
        <div>
          <span>Turmas</span>
          <strong>{r.turmas}</strong>
        </div>
        <div>
          <span>Alunos</span>
          <strong>{formatarNumero(r.alunos)}</strong>
        </div>
        <div>
          <span>Ocupação</span>
          <strong>{formatarPct(r.ocupacao)}</strong>
          <small className="texto-muted">
            {formatarNumero(r.alunos)} de {formatarNumero(r.capacidade)} vagas
          </small>
        </div>
        <div>
          <span>Alunos com deficiência (educação especial)</span>
          <strong>{r.especiais}</strong>
        </div>
        <div>
          <span>Turmas acima da capacidade</span>
          <strong className={r.superlotadas ? 'texto-nc' : ''}>{r.superlotadas}</strong>
        </div>
      </div>

      {mudancas && (
        <p className="pequeno" style={{ margin: 0 }}>
          <Users size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> Em relação a {anoAnterior}: {mudancas.alunos >= 0 ? '+' : ''}
          {formatarNumero(mudancas.alunos)} aluno(s)
          {mudancas.novas.length > 0 && `; turmas novas: ${mudancas.novas.join(', ')}`}
          {mudancas.encerradas.length > 0 && `; turmas que deixaram de existir: ${mudancas.encerradas.join(', ')}`}
          {!mudancas.novas.length && !mudancas.encerradas.length && '; mesmas turmas'}.
        </p>
      )}

      <div className="tabela-wrap">
        <table className="tabela tabela--compacta turmas">
          <thead>
            <tr>
              <th>Turma</th>
              <th>Série</th>
              <th>Turno</th>
              <th className="num">Alunos</th>
              <th className="num">Capacidade</th>
              <th className="num">Vagas</th>
              <th className="num">Ed. especial</th>
              <th>Checklist</th>
            </tr>
          </thead>
          {grupos.map((g) => (
            <tbody key={g.ensino}>
              <tr className="secao-linha">
                <td colSpan={8}>
                  <School size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> {g.ensino || 'Sem etapa'} · {g.resumo.turmas} turma(s) ·{' '}
                  {formatarNumero(g.resumo.alunos)} aluno(s) · ocupação {formatarPct(g.resumo.ocupacao)}
                </td>
              </tr>
              {g.series.flatMap((s) =>
                s.turmas.map((t) => {
                  const pend = respostas ? (t.turma in respostas ? pendentesDaTurma(respostas[t.turma]) : null) : undefined;
                  return (
                    <tr key={t.turma}>
                      <td className="forte nowrap" title={decodificarTurma(t.turma) ? `${decodificarTurma(t.turma)!.etapa} · turma ${decodificarTurma(t.turma)!.numero}` : undefined}>
                        {t.turma}
                      </td>
                      <td>{t.serie}</td>
                      <td>{TURNO_CURTO[t.turno] ?? t.turno}</td>
                      <td className="num">{t.alunos}</td>
                      <td className="num">{t.ocupacao}</td>
                      <td className="num">{t.vagas < 0 ? <span className="chip chip--nc" title="Mais alunos que a capacidade">{t.vagas}</span> : t.vagas}</td>
                      <td className="num">{t.especial || <span className="texto-muted">0</span>}</td>
                      <td>
                        {pend === undefined ? (
                          <span className="texto-muted">—</span>
                        ) : pend === null ? (
                          <span className="chip chip--nav">sem aba</span>
                        ) : pend === 0 ? (
                          <span className="chip chip--conforme">Conforme</span>
                        ) : (
                          <span className="chip chip--nc">{pend} pendente(s)</span>
                        )}
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
