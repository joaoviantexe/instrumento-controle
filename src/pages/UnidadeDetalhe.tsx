import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import { Dialogo, Etiqueta, Faixa, Medidor, Nota } from '../components/ui';
import { FormUnidade, GRUPOS_UNIDADE } from '../components/FormUnidade';
import { FormAuditoria, auditoriaVazia } from '../components/FormAuditoria';
import { Anexos } from '../components/Anexos';
import { AtosDiario } from '../components/AtosDiario';
import { CABECALHOS_UNIDADE as C, ROTULOS_ACAO, ROTULOS_PLANO, TEXTOS } from '../data/planilha';
import { useDados } from '../lib/store';
import { formatarCep, formatarData, formatarTelefone, fraseado } from '../lib/format';
import { diasRestantes, vigenciaVencida } from '../lib/calc';
import { avisar } from '../lib/avisos';
import type { Unidade } from '../lib/types';
import { NaoEncontrada } from './NaoEncontrada';

function valorExibido(u: Unidade, k: keyof Unidade) {
  const v = String(u[k] ?? '');
  if (!v) return <span className="texto-muted">—</span>;
  if (k === 'cep') return formatarCep(v);
  if (k === 'telefone' || k === 'contato') return formatarTelefone(v);
  if (k === 'data_atualizacao') return formatarData(v);
  if (k === 'vigencia_ato')
    return vigenciaVencida(v) ? (
      <span className="chip chip--nc">{formatarData(v)} · vencida</span>
    ) : (
      formatarData(v)
    );
  if (k === 'email') return <a href={`mailto:${v}`}>{v}</a>;
  if (k === 'situacao') return <Etiqueta valor={v} />;
  return v;
}

export function UnidadeDetalhe() {
  const { id = '' } = useParams();
  const d = useDados();
  const navegar = useNavigate();
  const [editando, setEditando] = useState(false);
  const [planejando, setPlanejando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const u = d.unidadePorId.get(id);
  if (!u) return <NaoEncontrada />;

  const auditorias = d.auditorias.filter((a) => a.unidade_id === id).sort((a, b) => b.id.localeCompare(a.id));
  const acoes = d.acoes.filter((a) => a.unidade_id === id);

  return (
    <>
      <Faixa bruto sobre={`${u.distrito} · ${u.bairro}`} titulo={u.nome} sub={[u.inep && `${C.inep}: ${u.inep}`, u.rede, u.tipo_unidade].filter(Boolean).join(' · ')}>
        <button type="button" className="btn btn--claro" onClick={() => setEditando(true)}>
          <Pencil size={16} aria-hidden /> Editar
        </button>
        <button type="button" className="btn btn--claro" onClick={() => setPlanejando(true)}>
          <CalendarPlus size={16} aria-hidden /> Nova auditoria
        </button>
      </Faixa>
      <div className="container pagina">
        <div>
          <Link to="/unidades" className="btn btn--neutro btn--pequeno">
            <ArrowLeft size={14} aria-hidden /> Cadastro Unidades
          </Link>
        </div>

        <div className="grade-2">
          {GRUPOS_UNIDADE.map((g) => (
            <section className="cartao" key={g.titulo}>
              <div className="cartao__cab">
                <h2 className="titulo-bloco">{g.titulo}</h2>
              </div>
              <dl className="cartao__corpo definicoes">
                {g.campos.map((k) => (
                  <div key={k} className={k === 'nome' || k === 'observacoes' || k.startsWith('ato_') ? 'largo' : ''}>
                    <dt>{C[k as keyof typeof C]}</dt>
                    <dd>{valorExibido(u, k)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <section className="cartao" aria-labelledby="atos-diario">
          <div className="cartao__cab">
            <h2 id="atos-diario" className="titulo-bloco">
              Atos no Diário Oficial
            </h2>
            <span className="contagem">Decretos, portarias e resoluções da unidade, com a página da publicação</span>
          </div>
          <div className="cartao__corpo">
            <AtosDiario unidadeId={u.id} />
          </div>
        </section>

        <section className="cartao" aria-labelledby="docs">
          <div className="cartao__cab">
            <h2 id="docs" className="titulo-bloco">
              Documentos
            </h2>
            <span className="contagem">Ex.: o PDF do ato de autorização, que comprova a vigência</span>
          </div>
          <div className="cartao__corpo">
            <Anexos entidade="unidade" entidadeId={u.id} />
          </div>
        </section>

        <section className="cartao">
          <div className="cartao__cab">
            <h2 className="titulo-bloco">{fraseado(TEXTOS.planoAuditoria.titulo)}</h2>
            <button type="button" className="btn btn--contorno btn--pequeno" onClick={() => setPlanejando(true)}>
              <CalendarPlus size={14} aria-hidden /> Nova auditoria
            </button>
          </div>
          {auditorias.length === 0 ? (
            <p className="tabela-vazia">{TEXTOS.instrucoes.passos[1].descricao}</p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>{ROTULOS_PLANO.id}</th>
                    <th>{ROTULOS_PLANO.tipo}</th>
                    <th>{ROTULOS_PLANO.situacao}</th>
                    <th>{ROTULOS_PLANO.dataPlanejada}</th>
                    <th>{ROTULOS_PLANO.dataRealizada}</th>
                    <th>{ROTULOS_PLANO.indice}</th>
                    <th>{ROTULOS_PLANO.ncCriticas}</th>
                  </tr>
                </thead>
                <tbody>
                  {auditorias.map((a) => {
                    const s = d.resumos.get(a.id);
                    return (
                      <tr key={a.id} className="clicavel" onClick={() => navegar(`/auditoria-documental/${a.id}`)}>
                        <td className="forte nowrap">
                          <Link to={`/auditoria-documental/${a.id}`}>{a.id}</Link>
                        </td>
                        <td>{a.tipo || '—'}</td>
                        <td>
                          <Etiqueta valor={a.situacao} />
                        </td>
                        <td className="nowrap">{formatarData(a.data_planejada) || '—'}</td>
                        <td className="nowrap">{formatarData(a.data_realizada) || '—'}</td>
                        <td>
                          <Medidor valor={s?.indice ?? null} />
                        </td>
                        <td className="num">{s?.iniciada ? s.ncCriticas : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="cartao">
          <div className="cartao__cab">
            <h2 className="titulo-bloco">{fraseado(TEXTOS.planoAcao.titulo)}</h2>
            <Link to={`/plano-de-acao?unidade=${u.id}`} className="btn btn--contorno btn--pequeno">
              Abrir no Plano de Ação
            </Link>
          </div>
          {acoes.length === 0 ? (
            <p className="tabela-vazia">{TEXTOS.planoAcao.nota}</p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>{ROTULOS_ACAO.id}</th>
                    <th>{ROTULOS_ACAO.item}</th>
                    <th>{ROTULOS_ACAO.acao}</th>
                    <th>{ROTULOS_ACAO.prazo}</th>
                    <th>{ROTULOS_ACAO.diasRestantes}</th>
                    <th>{ROTULOS_ACAO.situacao}</th>
                    <th>{ROTULOS_ACAO.validacao}</th>
                  </tr>
                </thead>
                <tbody>
                  {acoes.map((a) => (
                    <tr key={a.id} className="clicavel" onClick={() => navegar(`/plano-de-acao?acao=${a.id}`)}>
                      <td className="forte nowrap">{a.id}</td>
                      <td className="nowrap">{a.item}</td>
                      <td>{a.acao || a.achado}</td>
                      <td className="nowrap">{formatarData(a.prazo) || '—'}</td>
                      <td className="num">{diasRestantes(a.prazo) ?? '—'}</td>
                      <td>
                        <Etiqueta valor={a.situacao} />
                      </td>
                      <td>
                        <Etiqueta valor={a.validacao} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="nao-imprimir">
          <button type="button" className="btn btn--perigo" onClick={() => setExcluindo(true)}>
            <Trash2 size={16} aria-hidden /> Excluir unidade
          </button>
        </div>
      </div>

      {editando && (
        <FormUnidade
          inicial={u}
          aoFechar={() => setEditando(false)}
          aoSalvar={async (nova) => {
            await d.salvarUnidade(nova);
            avisar('Cadastro atualizado.');
          }}
        />
      )}
      {planejando && (
        <FormAuditoria
          inicial={{ ...auditoriaVazia(), unidade_id: u.id }}
          aoFechar={() => setPlanejando(false)}
          aoSalvar={async (a) => {
            const novoId = await d.criarAuditoria(a);
            avisar(`Auditoria ${novoId} registrada.`);
          }}
        />
      )}
      {excluindo &&
        (auditorias.length > 0 ? (
          <Dialogo
            titulo="Excluir unidade"
            confirmar="Ver auditorias"
            aoConfirmar={() => navegar(`/plano-de-auditoria?unidade=${u.id}`)}
            aoFechar={() => setExcluindo(false)}
          >
            <Nota tipo="alerta">
              Esta unidade possui {auditorias.length} registro(s) no Plano de Auditoria. Exclua-os antes de excluir a
              unidade, ou altere a {C.situacao} para EXTINTA ou PARALISADA.
            </Nota>
          </Dialogo>
        ) : (
          <Dialogo
            titulo="Excluir unidade"
            confirmar="Excluir"
            perigo
            aoFechar={() => setExcluindo(false)}
            aoConfirmar={async () => {
              if (await d.excluirUnidade(u.id)) {
                avisar('Unidade excluída.');
                navegar('/unidades');
              }
            }}
          >
            <p>
              Excluir <strong>{u.nome}</strong> do cadastro? Esta ação não pode ser desfeita.
            </p>
          </Dialogo>
        ))}
    </>
  );
}
