import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ExternalLink, Pencil, Undo2, X } from 'lucide-react';
import { CampoArea, CampoSelect, CampoTexto, Dialogo, Nota } from './ui';
import { PdfsRedundantes } from './PdfsRedundantes';
import { PAINEL_CME, RESOLUCOES_CME } from '../lib/cme';
import { anexosRedundantes, atosDiarioSemLink, itensCme, itensDiario, unidadesSemResolucao, type ItemConferencia } from '../lib/conferencias';
import { ATOS_DIARIO, PAINEL_DIARIO, ROTULO_CONFIANCA } from '../lib/diario';
import { avisar } from '../lib/avisos';
import { formatarData } from '../lib/format';
import { useDados } from '../lib/store';

/** Linhas mostradas de cada vez nas listas longas (o CME tem mais de 130 associações a conferir). */
const PAGINA = 25;

type Filtro = 'pendentes' | 'conferidos' | 'todos';
const FILTROS = [
  { valor: 'pendentes', rotulo: 'Pendentes' },
  { valor: 'conferidos', rotulo: 'Já conferidos' },
  { valor: 'todos', rotulo: 'Todos' },
];

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Painel do administrador: unidades sem resolução do CME, associações prováveis (do CME e do Diário) para confirmar ou
 * recusar e atos do Diário sem link para a edição. As decisões ficam na tabela "conferencias" e valem na página da unidade.
 */
export function ConferenciaAtos() {
  const d = useDados();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('pendentes');
  const [recusando, setRecusando] = useState<ItemConferencia | null>(null);
  const [motivo, setMotivo] = useState('');
  const [editando, setEditando] = useState<ItemConferencia | null>(null);
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState<string | null>(null);
  const [quantos, setQuantos] = useState({ cme: PAGINA, diario: PAGINA });
  const filtrar = (f: Filtro) => {
    setFiltro(f);
    setQuantos({ cme: PAGINA, diario: PAGINA });
  };

  const nome = (id: string) => d.unidadePorId.get(id)?.nome ?? id;
  const achou = (id: string) => !busca.trim() || normalizar(`${id} ${nome(id)}`).includes(normalizar(busca.trim()));

  const cme = useMemo(() => itensCme(RESOLUCOES_CME, d.mapaConferencias), [d.mapaConferencias]);
  const diario = useMemo(() => itensDiario(ATOS_DIARIO, d.mapaConferencias), [d.mapaConferencias]);
  const semResolucao = useMemo(() => unidadesSemResolucao(d.unidades, RESOLUCOES_CME, d.mapaConferencias), [d.unidades, d.mapaConferencias]);
  const semLink = useMemo(() => atosDiarioSemLink(ATOS_DIARIO), []);
  const redundantes = useMemo(() => anexosRedundantes(d.anexos, RESOLUCOES_CME, ATOS_DIARIO, d.mapaConferencias), [d.anexos, d.mapaConferencias]);

  const aberto = (i: ItemConferencia) => !i.conferencia;
  const mostrar = (i: ItemConferencia) =>
    achou(i.unidade_id) && (filtro === 'todos' || (filtro === 'pendentes' ? aberto(i) : !aberto(i)));

  async function decidir(item: ItemConferencia, decisao: 'confirmado' | 'recusado', nota = '') {
    setSalvando(item.chave);
    try {
      await d.conferir({ fonte: item.fonte, ato_id: item.ato_id, unidade_id: item.unidade_id, decisao, nota });
      avisar(decisao === 'confirmado' ? 'Associação confirmada.' : 'Associação recusada: ela some da página da unidade.');
    } catch (e) {
      avisar('Não foi possível salvar: ' + (e as Error).message, 'erro');
    } finally {
      setSalvando(null);
    }
  }

  async function salvarObservacao(item: ItemConferencia, nota: string) {
    if (!item.conferencia) return;
    setSalvando(item.chave);
    try {
      await d.conferir({ fonte: item.fonte, ato_id: item.ato_id, unidade_id: item.unidade_id, decisao: item.conferencia.decisao, nota });
      avisar('Observação salva.');
    } catch (e) {
      avisar('Não foi possível salvar: ' + (e as Error).message, 'erro');
    } finally {
      setSalvando(null);
    }
  }

  async function desfazer(item: ItemConferencia) {
    setSalvando(item.chave);
    try {
      await d.desfazerConferencia({ fonte: item.fonte, ato_id: item.ato_id, unidade_id: item.unidade_id });
      avisar('Decisão desfeita.');
    } catch (e) {
      avisar('Não foi possível desfazer: ' + (e as Error).message, 'erro');
    } finally {
      setSalvando(null);
    }
  }

  const pendentesCme = cme.filter(aberto).length;
  const pendentesDiario = diario.filter(aberto).length;

  function tabela(itens: ItemConferencia[], vazio: string, fonte: 'cme' | 'diario') {
    const todos = itens.filter(mostrar);
    const lista = todos.slice(0, quantos[fonte]);
    if (todos.length === 0) return <p className="texto-muted">{vazio}</p>;
    return (
      <div className="tabela-wrap">
        <table className="tabela">
          <thead>
            <tr>
              <th>Unidade</th>
              <th>Ato</th>
              <th>Situação</th>
              <th>Conferência</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((i) => {
              const c = i.conferencia;
              return (
                <tr key={i.chave}>
                  <td>
                    <Link to={`/unidades/${i.unidade_id}`}>{nome(i.unidade_id)}</Link>
                    <br />
                    <small className="texto-muted">{i.unidade_id}</small>
                  </td>
                  <td>
                    <strong>{i.titulo}</strong> <span className="chip chip--azul">{i.relacao}</span>
                    <br />
                    <span className="pequeno">{i.descricao}</span>
                    {!c && i.nota && (
                      <>
                        <br />
                        <small className="texto-muted">{i.nota}</small>
                      </>
                    )}
                    {i.referencia && (
                      <>
                        <br />
                        <small className="texto-muted">{i.referencia}</small>
                      </>
                    )}
                  </td>
                  <td>
                    {c ? (
                      <span className={'chip ' + (c.decisao === 'confirmado' ? 'chip--verde' : 'chip--nc')}>{c.decisao === 'confirmado' ? 'Confirmado' : 'Recusado'}</span>
                    ) : (
                      <span className={'chip ' + (i.confianca === 'media' ? 'chip--parcial' : 'chip--nc')}>{ROTULO_CONFIANCA[i.confianca]}</span>
                    )}
                  </td>
                  <td>
                    <div className="varredura__botoes">
                      {i.url && (
                        <a className="btn btn--contorno btn--pequeno" href={i.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={14} aria-hidden /> Abrir PDF
                        </a>
                      )}
                      {c ? (
                        <>
                          <button type="button" className="btn btn--neutro btn--pequeno" disabled={salvando === i.chave} onClick={() => { setObservacao(c.nota); setEditando(i); }}>
                            <Pencil size={14} aria-hidden /> Observação
                          </button>
                          <button type="button" className="btn btn--neutro btn--pequeno" disabled={salvando === i.chave} onClick={() => void desfazer(i)}>
                            <Undo2 size={14} aria-hidden /> Desfazer
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn btn--verde btn--pequeno" disabled={salvando === i.chave} onClick={() => void decidir(i, 'confirmado')}>
                            <Check size={14} aria-hidden /> Confirmar
                          </button>
                          <button type="button" className="btn btn--neutro btn--pequeno" disabled={salvando === i.chave} onClick={() => { setMotivo(''); setRecusando(i); }}>
                            <X size={14} aria-hidden /> Recusar
                          </button>
                        </>
                      )}
                    </div>
                    {c && (
                      <small className="texto-muted">
                        {c.conferido_por || 'Neste navegador'}
                        {c.conferido_em ? ` · ${formatarData(c.conferido_em.slice(0, 10))}` : ''}
                        {c.nota ? ` · ${c.nota}` : ''}
                      </small>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {todos.length > lista.length && (
          <p style={{ margin: '12px 0 0' }}>
            <button type="button" className="btn btn--neutro btn--pequeno" onClick={() => setQuantos((q) => ({ ...q, [fonte]: q[fonte] + PAGINA }))}>
              Mostrar mais {Math.min(PAGINA, todos.length - lista.length)} (restam {todos.length - lista.length})
            </button>
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      {d.conferenciasErro && <Nota tipo="alerta">{d.conferenciasErro}</Nota>}

      <section className="cartao">
        <div className="cartao__cab">
          <h2 className="titulo-bloco">Conferência de atos</h2>
        </div>
        <div className="cartao__corpo" style={{ display: 'grid', gap: 16 }}>
          <p className="texto-muted pequeno" style={{ margin: 0 }}>
            Reúne o que ainda pede a sua decisão nos atos associados às unidades. <strong>Confirmar</strong> troca "Provável — confira" por "Conferido pela CDE" na
            página da unidade; <strong>Recusar</strong> tira a associação de lá. A decisão fica registrada com o seu e-mail e a data, e pode ser desfeita aqui.
          </p>
          <div className="metricas">
            <div>
              <span>Unidades sem resolução do CME</span>
              <strong>{semResolucao.length.toLocaleString('pt-BR')}</strong>
            </div>
            <div>
              <span>Resoluções do CME a conferir</span>
              <strong>{pendentesCme.toLocaleString('pt-BR')}</strong>
            </div>
            <div>
              <span>Atos do Diário a conferir</span>
              <strong>{pendentesDiario.toLocaleString('pt-BR')}</strong>
            </div>
            <div>
              <span>PDFs já cobertos por link</span>
              <strong>{redundantes.length.toLocaleString('pt-BR')}</strong>
            </div>
            <div>
              <span>Atos do Diário sem link</span>
              <strong>{semLink.length.toLocaleString('pt-BR')}</strong>
            </div>
          </div>
          <div className="varredura__faixa">
            <CampoTexto rotulo="Buscar unidade" valor={busca} aoMudar={(v) => { setBusca(v); setQuantos({ cme: PAGINA, diario: PAGINA }); }} placeholder="nome ou código (ex.: UN-148)" />
            <CampoSelect rotulo="Mostrar" valor={filtro} aoMudar={(v) => filtrar(v as Filtro)} opcoes={FILTROS} vazio={false} />
          </div>
        </div>
      </section>

      <section className="cartao">
        <div className="cartao__cab">
          <h2 className="titulo-bloco">Resoluções do CME a conferir</h2>
          <span className="contagem">{pendentesCme} pendentes</span>
        </div>
        <div className="cartao__corpo">{tabela(cme, 'Nenhuma resolução do CME neste filtro.', 'cme')}</div>
      </section>

      <section className="cartao">
        <div className="cartao__cab">
          <h2 className="titulo-bloco">Atos do Diário Oficial a conferir</h2>
          <span className="contagem">{pendentesDiario} pendentes</span>
        </div>
        <div className="cartao__corpo">{tabela(diario, 'Nenhum ato do Diário neste filtro.', 'diario')}</div>
      </section>

      <PdfsRedundantes achou={achou} />

      <section className="cartao">
        <div className="cartao__cab">
          <h2 className="titulo-bloco">Unidades sem resolução do CME</h2>
          <span className="contagem">{semResolucao.length} unidades</span>
        </div>
        <div className="cartao__corpo" style={{ display: 'grid', gap: 12 }}>
          <p className="texto-muted pequeno" style={{ margin: 0 }}>
            Unidades para as quais o site do CME não tem resolução com o nome delas (nem com nomes antigos conhecidos). Se a resolução existir, procure-a no{' '}
            <a href={PAINEL_CME} target="_blank" rel="noopener noreferrer">
              site do CME
            </a>{' '}
            e peça a inclusão; se a unidade ainda não foi autorizada, é uma pendência de regularização.
          </p>
          {(() => {
            const lista = semResolucao.filter((u) => achou(u.id));
            if (lista.length === 0) return <p className="texto-muted">Nenhuma unidade neste filtro.</p>;
            return (
              <div className="tabela-wrap">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Unidade</th>
                      <th>Rede</th>
                      <th>Situação</th>
                      <th>Ato de autorização no cadastro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <Link to={`/unidades/${u.id}`}>{u.nome}</Link>
                          <br />
                          <small className="texto-muted">{u.id}</small>
                        </td>
                        <td>{u.rede || '—'}</td>
                        <td>{u.situacao || '—'}</td>
                        <td>{u.ato_autorizacao || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      </section>

      <section className="cartao">
        <div className="cartao__cab">
          <h2 className="titulo-bloco">Atos do Diário sem link para a edição</h2>
          <span className="contagem">{semLink.length} atos</span>
        </div>
        <div className="cartao__corpo" style={{ display: 'grid', gap: 12 }}>
          <p className="texto-muted pequeno" style={{ margin: 0 }}>
            Atos que ainda não abrem direto na página do Diário: falta o número da edição ou o texto veio do portal de leis. Procure a edição pela data no{' '}
            <a href={PAINEL_DIARIO} target="_blank" rel="noopener noreferrer">
              painel do Diário
            </a>
            ; a varredura da aba "Diário Oficial" também ajuda a achá-las.
          </p>
          {(() => {
            const lista = semLink.filter(({ ato }) => ato.unidades.some((v) => achou(v.id)));
            if (lista.length === 0) return <p className="texto-muted">Nenhum ato neste filtro.</p>;
            return (
              <div className="tabela-wrap">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Ato</th>
                      <th>Unidades</th>
                      <th>O que falta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map(({ ato, motivo }) => (
                      <tr key={ato.id}>
                        <td>
                          <strong>{ato.tipo} nº {ato.numero}</strong>
                          <br />
                          <span className="pequeno">{ato.ementa}</span>
                        </td>
                        <td>
                          {ato.unidades.map((v) => (
                            <div key={v.id}>
                              <Link to={`/unidades/${v.id}`}>{nome(v.id)}</Link>
                            </div>
                          ))}
                        </td>
                        <td className="pequeno">
                          {motivo}
                          {ato.publicacao?.data ? ` Publicado em ${formatarData(ato.publicacao.data)}.` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      </section>

      {editando && (
        <Dialogo
          titulo="Observação da conferência"
          confirmar="Salvar"
          aoFechar={() => setEditando(null)}
          aoConfirmar={() => {
            const item = editando;
            setEditando(null);
            void salvarObservacao(item, observacao.trim());
          }}
        >
          <p>
            {editando.titulo} em <strong>{nome(editando.unidade_id)}</strong>. Esta observação aparece na página da unidade no lugar da explicação automática da dúvida.
            Deixe em branco para não mostrar nada.
          </p>
          <CampoArea rotulo="Observação" valor={observacao} aoMudar={setObservacao} dica="Ex.: conferido no PDF; é a mesma escola." />
        </Dialogo>
      )}

      {recusando && (
        <Dialogo
          titulo="Recusar associação"
          confirmar="Recusar"
          perigo
          aoFechar={() => setRecusando(null)}
          aoConfirmar={() => {
            const item = recusando;
            setRecusando(null);
            void decidir(item, 'recusado', motivo.trim());
          }}
        >
          <p>
            {recusando.titulo} deixa de aparecer na página de <strong>{nome(recusando.unidade_id)}</strong>. Você pode desfazer depois, nesta tela (filtro "Já conferidos").
          </p>
          <CampoArea rotulo="Motivo (opcional)" valor={motivo} aoMudar={setMotivo} dica="Ex.: é outra escola, de nome parecido." />
        </Dialogo>
      )}
    </>
  );
}
