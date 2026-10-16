import { useMemo, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileArchive, FileUp, Trash2, TriangleAlert } from 'lucide-react';
import { DISTRITOS } from '../data/planilha';
import { avisar } from '../lib/avisos';
import { auditoriaDeReferencia, respostasComDados } from '../lib/checklist';
import { abrirXlsx, gerarChecklistExcel, nomeArquivoChecklist } from '../lib/checklistExcel';
import { baixar } from '../lib/exportar';
import { contem, formatarData, formatarNumero } from '../lib/format';
import { associarUnidades, contarPanorama, lerLinhasPanorama, linhasDaAba, resumirTurmas, type Panorama } from '../lib/panorama';
import { useDados } from '../lib/store';
import type { Unidade } from '../lib/types';
import { Dialogo, Nota } from './ui';

/** Dados e planilhas → Turmas: os panoramas de matrícula por ano e as checklists de cada unidade. */
export function PanoramaTurmas() {
  return (
    <>
      <AnosPanorama />
      <EnviarPanorama />
      <ChecklistsPorUnidade />
    </>
  );
}

function AnosPanorama() {
  const d = useDados();
  const [removendo, setRemovendo] = useState<number | null>(null);
  return (
    <section className="cartao">
      <div className="cartao__cab">
        <h2 className="titulo-bloco">Panorama de Matrícula por ano</h2>
        <span className="contagem">As turmas de cada unidade (relatório do SIGA)</span>
      </div>
      {d.panoramasErro && (
        <div className="cartao__corpo">
          <Nota tipo="alerta">{d.panoramasErro} Até lá, valem só os anos embutidos no site.</Nota>
        </div>
      )}
      {d.panoramas.length === 0 ? (
        <p className="tabela-vazia">Nenhum ano disponível.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela panoramas__anos">
            <thead>
              <tr>
                <th>Ano</th>
                <th>Origem</th>
                <th className="num">Unidades</th>
                <th className="num">Turmas</th>
                <th className="num">Alunos</th>
                <th>Arquivo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.panoramas.map((p) => (
                <tr key={p.ano}>
                  <td className="forte">{p.ano}</td>
                  <td>
                    {p.origem === 'embutido' ? (
                      <span className="chip chip--azul">Embutido no site</span>
                    ) : (
                      <span className="pequeno">
                        <span className="chip chip--verde">Enviado</span> {formatarData(p.atualizado_em.slice(0, 10))}
                        {p.atualizado_por && ` · ${p.atualizado_por}`}
                        {p.substituiEmbutido && ' · substitui o embutido'}
                      </span>
                    )}
                  </td>
                  <td className="num">{formatarNumero(p.unidades)}</td>
                  <td className="num">{formatarNumero(p.turmas)}</td>
                  <td className="num">{formatarNumero(p.alunos)}</td>
                  <td className="pequeno texto-muted">{p.fonte}</td>
                  <td>
                    {p.origem === 'enviado' && (
                      <button type="button" className="btn btn--neutro btn--pequeno" onClick={() => setRemovendo(p.ano)}>
                        <Trash2 size={14} aria-hidden /> Remover
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {removendo !== null && (
        <Dialogo
          titulo={`Remover o panorama de ${removendo}`}
          confirmar="Remover"
          perigo
          aoFechar={() => setRemovendo(null)}
          aoConfirmar={() =>
            void d
              .excluirPanorama(removendo)
              .then(() => avisar(`Panorama de ${removendo} removido.`))
              .catch((e: Error) => avisar('Não foi possível remover: ' + e.message, 'erro'))
          }
        >
          <p>
            As turmas enviadas para {removendo} deixam de valer
            {d.panoramas.find((p) => p.ano === removendo)?.substituiEmbutido ? '; volta a valer o panorama embutido no site.' : '.'} As checklists das
            unidades não são apagadas.
          </p>
        </Dialogo>
      )}
    </section>
  );
}

function EnviarPanorama() {
  const d = useDados();
  const entrada = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [lidos, setLidos] = useState<{ arquivo: string; panoramas: Panorama[]; avisos: string[] } | null>(null);
  const [anoPadrao, setAnoPadrao] = useState(String(new Date().getFullYear()));

  async function ler(f: File) {
    setLendo(true);
    setLidos(null);
    try {
      if (!/\.xlsx$/i.test(f.name)) throw new Error('envie um arquivo do Excel (.xlsx).');
      const wb = await abrirXlsx(await f.arrayBuffer());
      const { panoramas, avisos } = lerLinhasPanorama(linhasDaAba(wb.worksheets[0]), f.name, Number(anoPadrao) || undefined);
      // Ligações já feitas nos outros anos têm prioridade (o código da SEMEC não muda).
      const anteriores = new Map<string, string>();
      for (const info of d.panoramas) {
        const p = await d.obterPanorama(info.ano);
        for (const u of p?.unidades ?? []) if (u.unidade_id) anteriores.set(u.codigo, u.unidade_id);
      }
      setLidos({ arquivo: f.name, panoramas: panoramas.map((p) => associarUnidades(p, d.unidades, anteriores)), avisos });
    } catch (e) {
      avisar('Não foi possível ler o panorama: ' + (e as Error).message, 'erro');
    } finally {
      setLendo(false);
      if (entrada.current) entrada.current.value = '';
    }
  }

  async function salvar() {
    if (!lidos) return;
    setSalvando(true);
    try {
      for (const p of lidos.panoramas) await d.salvarPanorama(p);
      avisar(`Panorama salvo: ${lidos.panoramas.map((p) => p.ano).join(', ')}.`);
      setLidos(null);
    } catch (e) {
      avisar('Não foi possível salvar: ' + (e as Error).message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setArrastando(false);
    const f = e.dataTransfer.files[0];
    if (f) void ler(f);
  };

  return (
    <section className="cartao">
      <div className="cartao__cab">
        <h2 className="titulo-bloco">Atualizar o panorama de um ano</h2>
        <FileUp size={22} aria-hidden style={{ color: 'var(--verde-texto)' }} />
      </div>
      <div className="cartao__corpo" style={{ display: 'grid', gap: 14 }}>
        <>
            <p className="texto-muted pequeno" style={{ margin: 0 }}>
              Envie o relatório <em>Panorama de Matrícula</em> exportado do SIGA (.xlsx, uma linha por turma). O ano vem da coluna Ano; um arquivo com
              vários anos atualiza cada um. As unidades são ligadas ao cadastro pelo código da SEMEC já conhecido, pelo INEP e pelo nome. Enviar de
              novo um ano substitui as turmas dele.
            </p>
            <div
              className={'anexos__drop' + (arrastando ? ' anexos__drop--ativo' : '')}
              onDragOver={(e) => {
                e.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={soltar}
            >
              <FileUp size={20} aria-hidden />
              <span>Arraste o panorama (.xlsx) para cá ou</span>
              <button type="button" className="btn btn--primario btn--pequeno" disabled={lendo || salvando} onClick={() => entrada.current?.click()}>
                {lendo ? 'Lendo…' : 'Escolher planilha'}
              </button>
              <label className="seletor-ano">
                <span>Ano (se a planilha não tiver a coluna)</span>
                <input type="number" min={2000} max={2100} value={anoPadrao} onChange={(e) => setAnoPadrao(e.target.value)} style={{ width: 90 }} />
              </label>
              <input ref={entrada} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => e.target.files?.[0] && void ler(e.target.files[0])} />
            </div>
        </>

        {lidos && (
          <div className="importacao">
            <strong>{lidos.arquivo}</strong>
            {lidos.panoramas.map((p) => {
              const n = contarPanorama(p);
              const soltas = p.unidades.filter((u) => !u.unidade_id);
              const r = resumirTurmas(p.unidades.flatMap((u) => u.turmas));
              const existente = d.panoramas.find((x) => x.ano === p.ano);
              return (
                <div key={p.ano} style={{ display: 'grid', gap: 8 }}>
                  <dl className="definicoes" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                    <div>
                      <dt>Ano</dt>
                      <dd className="forte">{p.ano}</dd>
                    </div>
                    <div>
                      <dt>Unidades</dt>
                      <dd>
                        {n.unidades} ({n.associadas} ligadas ao cadastro)
                      </dd>
                    </div>
                    <div>
                      <dt>Turmas</dt>
                      <dd>{formatarNumero(n.turmas)}</dd>
                    </div>
                    <div>
                      <dt>Alunos</dt>
                      <dd>{formatarNumero(n.alunos)}</dd>
                    </div>
                    <div>
                      <dt>Turmas acima da capacidade</dt>
                      <dd>{r.superlotadas}</dd>
                    </div>
                  </dl>
                  {existente && (
                    <Nota tipo="alerta">
                      Substitui o panorama de {p.ano} {existente.origem === 'embutido' ? 'embutido no site' : `enviado em ${formatarData(existente.atualizado_em.slice(0, 10))}`} (
                      {formatarNumero(existente.turmas)} turmas).
                    </Nota>
                  )}
                  {soltas.length > 0 && (
                    <Nota tipo="alerta">
                      <TriangleAlert size={14} aria-hidden /> {soltas.length} unidade(s) do panorama não foram encontradas no cadastro (as turmas ficam
                      guardadas, mas não aparecem em nenhuma unidade até ela ser cadastrada):
                      <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                        {soltas.slice(0, 10).map((u) => (
                          <li key={u.codigo}>
                            {u.nome} (INEP {u.inep || '—'}, código {u.codigo})
                          </li>
                        ))}
                        {soltas.length > 10 && <li>… e mais {soltas.length - 10}.</li>}
                      </ul>
                    </Nota>
                  )}
                </div>
              );
            })}
            {lidos.avisos.length > 0 && (
              <Nota tipo="alerta">
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {lidos.avisos.slice(0, 8).map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </Nota>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn--verde" disabled={salvando} onClick={() => void salvar()}>
                {salvando ? 'Salvando…' : `Salvar ${lidos.panoramas.map((p) => p.ano).join(', ')}`}
              </button>
              <button type="button" className="btn btn--neutro" disabled={salvando} onClick={() => setLidos(null)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ChecklistsPorUnidade() {
  const d = useDados();
  const anos = d.panoramas.map((p) => p.ano);
  const [anoEscolhido, setAno] = useState<number | null>(null);
  const ano = anoEscolhido ?? anos[0] ?? new Date().getFullYear();
  const [distrito, setDistrito] = useState('');
  const [busca, setBusca] = useState('');
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null);
  const [comDados, setComDados] = useState(true);

  const enviadas = useMemo(() => new Map(d.checklists.filter((c) => c.ano === ano).map((c) => [c.unidade_id, c])), [d.checklists, ano]);
  const lista = useMemo(
    () =>
      d.unidades
        .filter((u) => (!distrito || u.distrito === distrito) && (!busca.trim() || contem(u.nome, busca) || u.inep.includes(busca.trim())))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [d.unidades, distrito, busca],
  );

  /** Planilha de uma unidade, com as turmas do ano e as respostas já enviadas. */
  async function planilha(u: Unidade, p: Panorama | null) {
    const up = p?.unidades.find((x) => x.unidade_id === u.id);
    if (!comDados) return gerarChecklistExcel({ unidade: u, ano, turmas: up?.turmas ?? [], panorama: up });
    const salvas = enviadas.has(u.id) ? ((await d.obterChecklist(u.id, ano)) ?? undefined) : undefined;
    const ref = auditoriaDeReferencia(d.auditorias, u.id);
    const codigos = (up?.turmas ?? []).map((t) => t.turma);
    const respostas = respostasComDados(codigos, salvas, ref && d.mapaAvaliacoes.get(ref.id), ref && d.mapaTurmas.get(ref.id));
    return gerarChecklistExcel({ unidade: u, ano, turmas: up?.turmas ?? [], panorama: up, respostas });
  }

  async function gerarUma(u: Unidade) {
    try {
      const { buffer, nome } = await planilha(u, await d.obterPanorama(ano));
      baixar(new Blob([buffer]), nome);
    } catch (e) {
      avisar('Não foi possível gerar: ' + (e as Error).message, 'erro');
    }
  }

  async function gerarTodas() {
    setProgresso({ feitos: 0, total: lista.length });
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const p = await d.obterPanorama(ano);
      for (let i = 0; i < lista.length; i++) {
        const u = lista[i];
        const { buffer } = await planilha(u, p);
        zip.file(`${u.distrito || 'SEM DISTRITO'}/${nomeArquivoChecklist(u, ano)}`, buffer);
        setProgresso({ feitos: i + 1, total: lista.length });
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      baixar(blob, `Checklists_Secretaria_Escolar_${ano}${distrito ? '_' + distrito : ''}.zip`);
      avisar(`${lista.length} planilha(s) gerada(s).`);
    } catch (e) {
      avisar('Não foi possível gerar as planilhas: ' + (e as Error).message, 'erro');
    } finally {
      setProgresso(null);
    }
  }

  return (
    <section className="cartao">
      <div className="cartao__cab">
        <h2 className="titulo-bloco">Checklist da secretaria escolar por unidade</h2>
        <span className="contagem">
          {enviadas.size} de {d.unidades.length} unidades enviaram a checklist de {ano}
        </span>
      </div>
      <div className="cartao__corpo" style={{ display: 'grid', gap: 14 }}>
        <p className="texto-muted pequeno" style={{ margin: 0 }}>
          Gera a planilha de cada unidade no formato do modelo da CDE (identificação, turmas do ano e uma aba de checklist por turma). <strong>Com
          dados</strong>, cada documento sai com a situação atual: o que a CDE avaliou e, onde ela ainda não avaliou, a última resposta da secretaria;{' '}
          <strong>em branco</strong>, tudo como Não avaliado. Para enviar a planilha preenchida, abra a página da unidade.
        </p>
        <div className="filtros-linha" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {anos.length > 1 && (
            <label className="seletor-ano">
              <span>Ano</span>
              <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
                {anos.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
          )}
          <label className="seletor-ano">
            <span>Distrito</span>
            <select value={distrito} onChange={(e) => setDistrito(e.target.value)}>
              <option value="">Todos</option>
              {DISTRITOS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="seletor-ano">
            <span>Buscar</span>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou INEP" style={{ padding: '5px 10px', border: '1px solid var(--borda-forte)', borderRadius: 'var(--raio)' }} />
          </label>
          <label className="seletor-ano">
            <span>Conteúdo</span>
            <select value={comDados ? 'dados' : 'branco'} onChange={(e) => setComDados(e.target.value === 'dados')}>
              <option value="dados">Com dados (CDE + secretaria)</option>
              <option value="branco">Em branco</option>
            </select>
          </label>
          <button type="button" className="btn btn--primario btn--pequeno" disabled={!!progresso || !lista.length} onClick={() => void gerarTodas()}>
            <FileArchive size={14} aria-hidden /> Baixar {lista.length} planilha(s) (.zip)
          </button>
        </div>
        {progresso && (
          <div className="progresso-lote" role="status">
            <span className="pequeno">
              Gerando {progresso.feitos} de {progresso.total}…
            </span>
            <div className="armazenamento__trilho">
              <div className="armazenamento__barra" style={{ width: `${(progresso.feitos / Math.max(1, progresso.total)) * 100}%` }} />
            </div>
          </div>
        )}
        <div className="tabela-wrap tabela-wrap--alta">
          <table className="tabela tabela--compacta">
            <thead>
              <tr>
                <th>Unidade</th>
                <th>Distrito</th>
                <th>Checklist de {ano}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lista.map((u) => {
                const c = enviadas.get(u.id);
                return (
                  <tr key={u.id}>
                    <td>
                      <Link to={`/unidades/${u.id}#checklist-secretaria`}>{u.nome}</Link>
                    </td>
                    <td>{u.distrito}</td>
                    <td className="pequeno">
                      {c ? (
                        <>
                          <span className={'chip ' + (c.pendentes ? 'chip--parcial' : 'chip--conforme')}>{c.pendentes ? `${c.pendentes} pendência(s)` : 'Sem pendências'}</span>{' '}
                          enviada em {formatarData(c.atualizado_em.slice(0, 10))}
                        </>
                      ) : (
                        <span className="texto-muted">não enviada</span>
                      )}
                    </td>
                    <td>
                      <button type="button" className="btn btn--neutro btn--pequeno" onClick={() => void gerarUma(u)}>
                        <Download size={14} aria-hidden /> Gerar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
