import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardCheck, ClipboardList, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { CampoSelect, Dialogo, Etiqueta, Faixa, Medidor, Nota, Th, ordenar, useOrdenacao, useRotulosCartao } from '../components/ui';
import { FormAuditoria, auditoriaVazia } from '../components/FormAuditoria';
import { DISTRITOS, PRIORIDADES, ROTULOS_PLANO as R, SITUACOES_AUDITORIA, TEXTOS, TIPOS_VERIFICACAO } from '../data/planilha';
import { useDados } from '../lib/store';
import { contem, formatarData, formatarPct } from '../lib/format';
import { exportarExcel } from '../lib/exportar';
import { abaPlano } from '../lib/abas';
import { avisar } from '../lib/avisos';
import type { Auditoria } from '../lib/types';

type Campo =
  | 'id'
  | 'unidade'
  | 'distrito'
  | 'tipo'
  | 'prioridade'
  | 'data_planejada'
  | 'data_realizada'
  | 'situacao'
  | 'avaliados'
  | 'indice'
  | 'nc';

const SEM_SITUACAO = '__vazio';

export function PlanoAuditoria() {
  const d = useDados();
  const [params, setParams] = useSearchParams();
  const [editando, setEditando] = useState<(Omit<Auditoria, 'id'> & { id?: string }) | null>(null);
  const [excluindo, setExcluindo] = useState<Auditoria | null>(null);
  const { ordem, alternar } = useOrdenacao<Campo>('id');
  const tabela = useRotulosCartao();

  const f = {
    busca: params.get('busca') ?? '',
    situacao: params.get('situacao') ?? '',
    distrito: params.get('distrito') ?? '',
    tipo: params.get('tipo') ?? '',
    prioridade: params.get('prioridade') ?? '',
    iniciadas: params.get('iniciadas') ?? '',
    unidade: params.get('unidade') ?? '',
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

  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of d.auditorias) m.set(a.situacao || SEM_SITUACAO, (m.get(a.situacao || SEM_SITUACAO) ?? 0) + 1);
    return m;
  }, [d.auditorias]);

  const filtradas = useMemo(() => {
    const lista = d.auditorias.filter((a) => {
      const u = d.unidadePorId.get(a.unidade_id);
      return (
        (!f.situacao || (f.situacao === SEM_SITUACAO ? !a.situacao : a.situacao === f.situacao)) &&
        (!f.distrito || u?.distrito === f.distrito) &&
        (!f.tipo || a.tipo === f.tipo) &&
        (!f.prioridade || a.prioridade === f.prioridade) &&
        (!f.iniciadas || a.iniciada) &&
        (!f.unidade || a.unidade_id === f.unidade) &&
        (!f.busca || [a.id, u?.nome ?? '', a.equipe, u?.inep ?? '', u?.bairro ?? ''].some((v) => contem(v, f.busca)))
      );
    });
    return ordenar(
      lista,
      (a) => {
        const u = d.unidadePorId.get(a.unidade_id);
        const s = d.resumos.get(a.id);
        switch (ordem.campo) {
          case 'unidade':
            return u?.nome ?? '';
          case 'distrito':
            return u?.distrito ?? '';
          case 'avaliados':
            return s?.iniciada ? s.avaliados : null;
          case 'indice':
            return s?.indice ?? null;
          case 'nc':
            return s?.iniciada ? s.ncCriticas : null;
          default:
            return a[ordem.campo];
        }
      },
      ordem.direcao,
    );
  }, [d, f.situacao, f.distrito, f.tipo, f.prioridade, f.iniciadas, f.unidade, f.busca, ordem]);

  const unidadeFiltro = f.unidade ? d.unidadePorId.get(f.unidade) : undefined;
  const filtrando = Object.values(f).some(Boolean);

  return (
    <>
      <Faixa sobre="Plano de Auditoria" titulo={TEXTOS.planoAuditoria.titulo} sub={TEXTOS.planoAuditoria.subtitulo}>
        <button type="button" className="btn btn--claro" onClick={() => setEditando(auditoriaVazia())}>
          <Plus size={16} aria-hidden /> Nova auditoria
        </button>
      </Faixa>
      <div className="container pagina">
        <Nota>
          <strong>{TEXTOS.instrucoes.passos[1].titulo}.</strong> {TEXTOS.instrucoes.passos[1].descricao}
        </Nota>

        <div className="pilulas" role="group" aria-label={R.situacao}>
          <button type="button" className="pilula" aria-pressed={!f.situacao} onClick={() => setF('situacao')('')}>
            Todas <b>{d.auditorias.length}</b>
          </button>
          {SITUACOES_AUDITORIA.map((s) => (
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
          {(contagem.get(SEM_SITUACAO) ?? 0) > 0 && (
            <button
              type="button"
              className="pilula"
              aria-pressed={f.situacao === SEM_SITUACAO}
              onClick={() => setF('situacao')(f.situacao === SEM_SITUACAO ? '' : SEM_SITUACAO)}
            >
              {R.situacao} não informada <b>{contagem.get(SEM_SITUACAO)}</b>
            </button>
          )}
        </div>

        <section className="cartao">
          <div className="cartao__corpo" style={{ display: 'grid', gap: 12 }}>
            <div className="ferramentas">
              <label className="busca">
                <span className="sr-only">Buscar</span>
                <Search size={18} aria-hidden />
                <input
                  type="search"
                  placeholder={`${R.id}, ${R.unidade}, ${R.equipe}…`}
                  value={f.busca}
                  onChange={(e) => setF('busca')(e.target.value)}
                />
              </label>
              <CampoSelect classe="campo--filtro" rotulo={R.distrito} valor={f.distrito} aoMudar={setF('distrito')} opcoes={DISTRITOS} vazio="Todos" />
              <CampoSelect classe="campo--filtro" rotulo={R.tipo} valor={f.tipo} aoMudar={setF('tipo')} opcoes={TIPOS_VERIFICACAO} vazio="Todos" />
              <CampoSelect classe="campo--filtro" rotulo={R.prioridade} valor={f.prioridade} aoMudar={setF('prioridade')} opcoes={PRIORIDADES} vazio="Todas" />
              <CampoSelect
                classe="campo--filtro"
                rotulo="Auditoria Documental"
                valor={f.iniciadas}
                aoMudar={setF('iniciadas')}
                opcoes={[{ valor: '1', rotulo: 'Com itens previstos' }]}
                vazio="Todas"
              />
            </div>
            <div className="ferramentas">
              <p className="contagem" aria-live="polite">
                {filtradas.length} de {d.auditorias.length} auditorias
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
                <button
                  type="button"
                  className="btn btn--contorno btn--pequeno"
                  onClick={() => void exportarExcel('Plano_de_Auditoria', [abaPlano(d, filtradas)])}
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
                  <Th campo="unidade" ordem={ordem} alternar={alternar}>
                    {R.unidade}
                  </Th>
                  <Th campo="distrito" ordem={ordem} alternar={alternar}>
                    {R.distrito}
                  </Th>
                  <Th campo="tipo" ordem={ordem} alternar={alternar}>
                    {R.tipo}
                  </Th>
                  <Th campo="prioridade" ordem={ordem} alternar={alternar}>
                    {R.prioridade}
                  </Th>
                  <Th campo="data_planejada" ordem={ordem} alternar={alternar}>
                    {R.dataPlanejada}
                  </Th>
                  <Th campo="data_realizada" ordem={ordem} alternar={alternar}>
                    {R.dataRealizada}
                  </Th>
                  <th scope="col">{R.equipe}</th>
                  <Th campo="situacao" ordem={ordem} alternar={alternar}>
                    {R.situacao}
                  </Th>
                  <th scope="col" className="num">
                    {R.previstos}
                  </th>
                  <Th campo="avaliados" ordem={ordem} alternar={alternar} className="num">
                    {R.avaliados}
                  </Th>
                  <Th campo="indice" ordem={ordem} alternar={alternar}>
                    {R.indice}
                  </Th>
                  <Th campo="nc" ordem={ordem} alternar={alternar} className="num">
                    {R.ncCriticas}
                  </Th>
                  <th scope="col" className="num">
                    {R.checklist}
                  </th>
                  <th scope="col">{R.observacoes}</th>
                  <th scope="col">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((a) => {
                  const u = d.unidadePorId.get(a.unidade_id);
                  const s = d.resumos.get(a.id);
                  return (
                    <tr key={a.id}>
                      <td className="nowrap forte">{a.id}</td>
                      <td className="larga principal">
                        {u ? <Link to={`/unidades/${u.id}`}>{u.nome}</Link> : <span className="texto-muted">—</span>}
                      </td>
                      <td>{u?.distrito}</td>
                      <td className="media">{a.tipo || <span className="texto-muted">—</span>}</td>
                      <td>
                        <Etiqueta valor={a.prioridade} />
                      </td>
                      <td className="nowrap">{formatarData(a.data_planejada) || '—'}</td>
                      <td className="nowrap">{formatarData(a.data_realizada) || '—'}</td>
                      <td>{a.equipe || <span className="texto-muted">—</span>}</td>
                      <td>
                        <Etiqueta valor={a.situacao} />
                      </td>
                      <td className="num">{s?.iniciada ? s.previstos : '—'}</td>
                      <td className="num">{s?.iniciada ? s.avaliados : '—'}</td>
                      <td>
                        <Medidor valor={s?.indice ?? null} />
                      </td>
                      <td className="num">{s?.iniciada ? s.ncCriticas : '—'}</td>
                      <td className="num">{s?.iniciada ? formatarPct(s.checklist) : '—'}</td>
                      <td className="media pequeno">{a.observacoes}</td>
                      <td className="nowrap">
                        <span style={{ display: 'inline-flex', gap: 4 }}>
                          <Link
                            to={`/auditoria-documental/${a.id}`}
                            className="btn btn--contorno btn--icone"
                            title="Auditoria Documental"
                            aria-label={`Auditoria Documental ${a.id}`}
                          >
                            <ClipboardCheck size={16} />
                          </Link>
                          <Link
                            to={`/checklist-da-visita/${a.id}`}
                            className="btn btn--neutro btn--icone"
                            title="Checklist da Visita"
                            aria-label={`Checklist da Visita ${a.id}`}
                          >
                            <ClipboardList size={16} />
                          </Link>
                          <button
                            type="button"
                            className="btn btn--neutro btn--icone"
                            onClick={() => setEditando(a)}
                            title="Editar"
                            aria-label={`Editar ${a.id}`}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            className="btn btn--perigo btn--icone"
                            onClick={() => setExcluindo(a)}
                            title="Excluir"
                            aria-label={`Excluir ${a.id}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtradas.length === 0 && <p className="tabela-vazia">Nenhuma auditoria encontrada.</p>}
          </div>
        </section>
      </div>

      {editando && (
        <FormAuditoria
          inicial={editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={async (a) => {
            if (a.id) {
              await d.salvarAuditoria(a as Auditoria);
              avisar(`Auditoria ${a.id} atualizada.`);
            } else {
              const id = await d.criarAuditoria(a);
              avisar(`Auditoria ${id} registrada.`);
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
            await d.excluirAuditoria(excluindo.id);
            avisar(`Auditoria ${excluindo.id} excluída.`);
          }}
        >
          <p>
            Excluir a auditoria <strong>{excluindo.id}</strong> e todos os registros da Auditoria Documental vinculados a
            ela? As ações do Plano de Ação são mantidas, sem o vínculo com a auditoria.
          </p>
        </Dialogo>
      )}
    </>
  );
}
