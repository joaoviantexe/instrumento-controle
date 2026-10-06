import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Plus, Search, Trash2 } from 'lucide-react';
import {
  CampoSelect,
  Dialogo,
  Etiqueta,
  Faixa,
  Nota,
  Th,
  Vazio,
  ordenar,
  useOrdenacao,
  useRotulosCartao,
} from '../components/ui';
import { FormAcao, acaoVazia, type RascunhoAcao } from '../components/FormAcao';
import { SeletorColunas, useColunas, type DefColuna } from '../components/Colunas';
import { DISTRITOS, ITEM_POR_CODIGO, PRIORIDADES, ROTULOS_ACAO as R, SITUACOES_ACAO, TEXTOS, VALIDACOES } from '../data/planilha';
import { useDados } from '../lib/store';
import { acaoAtrasada, diasRestantes } from '../lib/calc';
import { contem, formatarData } from '../lib/format';
import { exportarExcel } from '../lib/exportar';
import { abaAcoes } from '../lib/abas';
import { avisar } from '../lib/avisos';
import type { Acao } from '../lib/types';

type Campo =
  | 'id'
  | 'auditoria_id'
  | 'unidade'
  | 'item'
  | 'prioridade'
  | 'responsavel'
  | 'data_abertura'
  | 'prazo'
  | 'dias'
  | 'situacao'
  | 'validacao';

const COLUNAS: DefColuna[] = [
  { id: 'id', rotulo: R.id, fixa: true },
  { id: 'auditoria', rotulo: R.auditoria },
  { id: 'unidade', rotulo: R.unidade, fixa: true },
  { id: 'item', rotulo: R.item },
  { id: 'achado', rotulo: R.achado },
  { id: 'acao', rotulo: R.acao, fixa: true },
  { id: 'prioridade', rotulo: R.prioridade },
  { id: 'responsavel', rotulo: R.responsavel },
  { id: 'abertura', rotulo: R.dataAbertura },
  { id: 'prazo', rotulo: R.prazo },
  { id: 'dias', rotulo: R.diasRestantes },
  { id: 'situacao', rotulo: R.situacao },
  { id: 'evidencia', rotulo: R.evidencia },
  { id: 'conclusao', rotulo: R.dataConclusao },
  { id: 'validacao', rotulo: R.validacao },
];

const ORDEM_PRIORIDADE: Record<string, number> = Object.fromEntries(PRIORIDADES.map((p, i) => [p, i]));

/** Escala de cor dos dias restantes (formatação condicional da planilha). */
function DiasRestantes({ dias, aberta }: { dias: number | null; aberta: boolean }) {
  if (dias === null) return <span className="texto-muted">—</span>;
  const classe = !aberta ? 'chip--vazio' : dias < 0 ? 'chip--nc' : dias <= 7 ? 'chip--parcial' : 'chip--conforme';
  return <span className={`chip ${classe}`}>{dias}</span>;
}

export function PlanoAcao() {
  const d = useDados();
  const [params, setParams] = useSearchParams();
  const [editando, setEditando] = useState<RascunhoAcao | null>(null);
  const [excluindo, setExcluindo] = useState<Acao | null>(null);
  const { ordem, alternar } = useOrdenacao<Campo>('prazo');
  const tabela = useRotulosCartao();
  const cols = useColunas('plano-acao', COLUNAS, ['auditoria', 'achado', 'abertura', 'evidencia', 'conclusao']);
  const v = cols.visivel;

  const f = {
    busca: params.get('busca') ?? '',
    situacao: params.get('situacao') ?? '',
    prioridade: params.get('prioridade') ?? '',
    validacao: params.get('validacao') ?? '',
    distrito: params.get('distrito') ?? '',
    unidade: params.get('unidade') ?? '',
    vencidas: params.get('vencidas') ?? '',
  };
  const setF = (k: keyof typeof f) => (v: string) =>
    setParams(
      (p) => {
        if (v) p.set(k, v);
        else p.delete(k);
        return p;
      },
      { replace: true },
    );

  // Abre diretamente uma ação indicada no endereço (?acao=AC-001)
  const acaoParam = params.get('acao');
  useEffect(() => {
    if (!acaoParam) return;
    const a = d.acoes.find((x) => x.id === acaoParam);
    if (a) setEditando(a);
    setParams(
      (p) => {
        p.delete('acao');
        return p;
      },
      { replace: true },
    );
  }, [acaoParam, d.acoes, setParams]);

  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of d.acoes) m.set(a.situacao, (m.get(a.situacao) ?? 0) + 1);
    return m;
  }, [d.acoes]);
  const vencidas = d.acoes.filter((a) => acaoAtrasada(a)).length;

  const filtradas = useMemo(() => {
    const lista = d.acoes.filter((a) => {
      const u = d.unidadePorId.get(a.unidade_id);
      return (
        (!f.situacao || a.situacao === f.situacao) &&
        (!f.prioridade || a.prioridade === f.prioridade) &&
        (!f.validacao || a.validacao === f.validacao) &&
        (!f.distrito || u?.distrito === f.distrito) &&
        (!f.unidade || a.unidade_id === f.unidade) &&
        (!f.vencidas || acaoAtrasada(a)) &&
        (!f.busca ||
          [a.id, a.auditoria_id, u?.nome ?? '', a.item, a.achado, a.acao, a.responsavel].some((v) => contem(v, f.busca)))
      );
    });
    return ordenar(
      lista,
      (a) => {
        switch (ordem.campo) {
          case 'unidade':
            return d.unidadePorId.get(a.unidade_id)?.nome ?? '';
          case 'dias':
            return diasRestantes(a.prazo);
          case 'prioridade':
            return a.prioridade ? (ORDEM_PRIORIDADE[a.prioridade] ?? 99) : null;
          default:
            return a[ordem.campo];
        }
      },
      ordem.direcao,
    );
  }, [d.acoes, d.unidadePorId, f.situacao, f.prioridade, f.validacao, f.distrito, f.unidade, f.vencidas, f.busca, ordem]);

  const filtrando = Object.values(f).some(Boolean);
  const unidadeFiltro = f.unidade ? d.unidadePorId.get(f.unidade) : undefined;

  return (
    <>
      <Faixa titulo={TEXTOS.planoAcao.titulo} sub={TEXTOS.planoAcao.subtitulo}>
        <button type="button" className="btn btn--claro" onClick={() => setEditando({ ...acaoVazia(), unidade_id: f.unidade })}>
          <Plus size={16} aria-hidden /> Nova ação
        </button>
      </Faixa>
      <div className="container pagina">
        <Nota>{TEXTOS.planoAcao.nota}</Nota>

        <div className="pilulas" role="group" aria-label={R.situacao}>
          <button
            type="button"
            className="pilula"
            aria-pressed={!f.situacao && !f.vencidas}
            onClick={() => setParams({}, { replace: true })}
          >
            Todas <b>{d.acoes.length}</b>
          </button>
          {SITUACOES_ACAO.map((s) => (
            <button
              type="button"
              key={s}
              className="pilula"
              aria-pressed={f.situacao === s}
              onClick={() => setF('situacao')(f.situacao === s ? '' : s)}
            >
              {s} <b>{contagem.get(s) ?? 0}</b>
            </button>
          ))}
          <button
            type="button"
            className="pilula"
            aria-pressed={!!f.vencidas}
            onClick={() => setF('vencidas')(f.vencidas ? '' : '1')}
          >
            {R.prazo} expirado <b>{vencidas}</b>
          </button>
        </div>

        <section className="cartao">
          <div className="cartao__corpo" style={{ display: 'grid', gap: 12 }}>
            <div className="ferramentas">
              <label className="busca">
                <span className="sr-only">Buscar</span>
                <Search size={18} aria-hidden />
                <input
                  type="search"
                  placeholder={`${R.id}, ${R.unidade}, ${R.achado}, ${R.responsavel}…`}
                  value={f.busca}
                  onChange={(e) => setF('busca')(e.target.value)}
                />
              </label>
              <CampoSelect
                classe="campo--filtro"
                rotulo="Distrito"
                valor={f.distrito}
                aoMudar={setF('distrito')}
                opcoes={DISTRITOS}
                vazio="Todos"
              />
              <CampoSelect
                classe="campo--filtro"
                rotulo={R.prioridade}
                valor={f.prioridade}
                aoMudar={setF('prioridade')}
                opcoes={PRIORIDADES}
                vazio="Todas"
              />
              <CampoSelect
                classe="campo--filtro"
                rotulo={R.validacao}
                valor={f.validacao}
                aoMudar={setF('validacao')}
                opcoes={VALIDACOES}
                vazio="Todas"
              />
            </div>
            <div className="ferramentas">
              <p className="contagem" aria-live="polite">
                {filtradas.length} de {d.acoes.length} ações
                {unidadeFiltro && (
                  <>
                    {' '}
                    · {R.unidade}: <strong>{unidadeFiltro.nome}</strong>
                  </>
                )}
              </p>
              <div className="ferramentas__direita">
                {filtrando && (
                  <button type="button" className="btn btn--neutro btn--pequeno" onClick={() => setParams({}, { replace: true })}>
                    Limpar filtros
                  </button>
                )}
                <SeletorColunas estado={cols} />
                <button
                  type="button"
                  className="btn btn--contorno btn--pequeno"
                  onClick={() => void exportarExcel('Plano_de_Acao', [abaAcoes(d, filtradas)])}
                >
                  <Download size={14} aria-hidden /> Exportar Excel
                </button>
              </div>
            </div>
          </div>
          <div className="tabela-wrap tabela-wrap--alta">
            <table className="tabela tabela--cartoes" ref={tabela}>
              <thead>
                <tr>
                  <Th campo="id" ordem={ordem} alternar={alternar}>
                    {R.id}
                  </Th>
                  {v('auditoria') && (
                    <Th campo="auditoria_id" ordem={ordem} alternar={alternar}>
                      {R.auditoria}
                    </Th>
                  )}
                  <Th campo="unidade" ordem={ordem} alternar={alternar}>
                    {R.unidade}
                  </Th>
                  {v('item') && (
                    <Th campo="item" ordem={ordem} alternar={alternar}>
                      {R.item}
                    </Th>
                  )}
                  {v('achado') && <th scope="col">{R.achado}</th>}
                  <th scope="col">{R.acao}</th>
                  {v('prioridade') && (
                    <Th campo="prioridade" ordem={ordem} alternar={alternar}>
                      {R.prioridade}
                    </Th>
                  )}
                  {v('responsavel') && (
                    <Th campo="responsavel" ordem={ordem} alternar={alternar}>
                      {R.responsavel}
                    </Th>
                  )}
                  {v('abertura') && (
                    <Th campo="data_abertura" ordem={ordem} alternar={alternar}>
                      {R.dataAbertura}
                    </Th>
                  )}
                  {v('prazo') && (
                    <Th campo="prazo" ordem={ordem} alternar={alternar}>
                      {R.prazo}
                    </Th>
                  )}
                  {v('dias') && (
                    <Th campo="dias" ordem={ordem} alternar={alternar} className="num">
                      {R.diasRestantes}
                    </Th>
                  )}
                  {v('situacao') && (
                    <Th campo="situacao" ordem={ordem} alternar={alternar}>
                      {R.situacao}
                    </Th>
                  )}
                  {v('evidencia') && <th scope="col">{R.evidencia}</th>}
                  {v('conclusao') && <th scope="col">{R.dataConclusao}</th>}
                  {v('validacao') && (
                    <Th campo="validacao" ordem={ordem} alternar={alternar}>
                      {R.validacao}
                    </Th>
                  )}
                  <th scope="col">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((a) => {
                  const u = d.unidadePorId.get(a.unidade_id);
                  const aberta = a.situacao !== 'Concluída' && a.situacao !== 'Suspensa';
                  return (
                    <tr
                      key={a.id}
                      className="clicavel"
                      onClick={() => setEditando(a)}
                      onKeyDown={(e) => e.key === 'Enter' && setEditando(a)}
                      tabIndex={0}
                    >
                      <td className="forte nowrap">{a.id}</td>
                      {v('auditoria') && (
                        <td className="nowrap">
                          {a.auditoria_id ? (
                            <Link to={`/auditoria-documental/${a.auditoria_id}`} onClick={(e) => e.stopPropagation()}>
                              {a.auditoria_id}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
                      <td className="media">{u?.nome ?? '—'}</td>
                      {v('item') && (
                        <td className="nowrap" title={ITEM_POR_CODIGO[a.item]?.item}>
                          {a.item || '—'}
                        </td>
                      )}
                      {v('achado') && <td className="media">{a.achado}</td>}
                      <td className="larga principal">{a.acao}</td>
                      {v('prioridade') && (
                        <td>
                          <Etiqueta valor={a.prioridade} />
                        </td>
                      )}
                      {v('responsavel') && <td>{a.responsavel}</td>}
                      {v('abertura') && <td className="nowrap">{formatarData(a.data_abertura)}</td>}
                      {v('prazo') && <td className="nowrap">{formatarData(a.prazo)}</td>}
                      {v('dias') && (
                        <td className="num">
                          <DiasRestantes dias={diasRestantes(a.prazo)} aberta={aberta} />
                        </td>
                      )}
                      {v('situacao') && (
                        <td>
                          <Etiqueta valor={a.situacao} />
                        </td>
                      )}
                      {v('evidencia') && <td className="media pequeno">{a.evidencia}</td>}
                      {v('conclusao') && <td className="nowrap">{formatarData(a.data_conclusao)}</td>}
                      {v('validacao') && (
                        <td>
                          <Etiqueta valor={a.validacao} />
                        </td>
                      )}
                      <td>
                        <button
                          type="button"
                          className="btn btn--perigo btn--icone"
                          title="Excluir"
                          aria-label={`Excluir ${a.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExcluindo(a);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtradas.length === 0 && (
              <Vazio texto={d.acoes.length === 0 ? TEXTOS.instrucoes.passos[6].descricao : 'Nenhuma ação encontrada.'}>
                {d.acoes.length === 0 ? (
                  <button
                    type="button"
                    className="btn btn--primario btn--pequeno"
                    onClick={() => setEditando({ ...acaoVazia(), unidade_id: f.unidade })}
                  >
                    <Plus size={14} aria-hidden /> Nova ação
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--contorno btn--pequeno"
                    onClick={() => setParams({}, { replace: true })}
                  >
                    Limpar filtros
                  </button>
                )}
              </Vazio>
            )}
          </div>
        </section>
      </div>

      {editando && (
        <FormAcao
          inicial={editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={async (a) => {
            if (a.id) {
              await d.salvarAcao(a as Acao);
              avisar(`Ação ${a.id} atualizada.`);
            } else {
              const id = await d.criarAcao(a);
              avisar(`Ação ${id} registrada.`);
            }
          }}
        />
      )}
      {excluindo && (
        <Dialogo
          titulo={`Excluir ${excluindo.id}`}
          confirmar="Excluir"
          perigo
          aoFechar={() => setExcluindo(null)}
          aoConfirmar={async () => {
            await d.excluirAcao(excluindo.id);
            avisar(`Ação ${excluindo.id} excluída.`);
          }}
        >
          <p>Excluir a ação {excluindo.id} do Plano de Ação? Esta ação não pode ser desfeita.</p>
        </Dialogo>
      )}
    </>
  );
}
