import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Trash2 } from 'lucide-react';
import { Dialogo, Nota } from './ui';
import { formatarTamanho } from '../lib/anexos';
import { avisar } from '../lib/avisos';
import { RESOLUCOES_CME } from '../lib/cme';
import { anexosRedundantes } from '../lib/conferencias';
import { ATOS_DIARIO } from '../lib/diario';
import { formatarData } from '../lib/format';
import { useDados } from '../lib/store';
import type { Anexo } from '../lib/types';

const PAGINA = 25;

/**
 * PDFs enviados à mão (Decreto, Ato de criação, Ato de autorização e resoluções do CME) que o site já tem como link do CME ou do
 * Diário. Nada vem marcado: quem confere abre o PDF e o link lado a lado, marca os que são o mesmo documento e exclui. Apagar libera
 * espaço no banco e não tem volta.
 */
export function PdfsRedundantes({ achou }: { achou: (unidadeId: string) => boolean }) {
  const d = useDados();
  const todos = useMemo(() => anexosRedundantes(d.anexos, RESOLUCOES_CME, ATOS_DIARIO, d.mapaConferencias), [d.anexos, d.mapaConferencias]);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [quantos, setQuantos] = useState(PAGINA);
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const filtrados = todos.filter((x) => achou(x.anexo.entidade_id));
  const lista = filtrados.slice(0, quantos);
  const escolhidos = todos.filter((x) => marcados.has(x.anexo.id));
  const bytes = escolhidos.reduce((s, x) => s + x.anexo.tamanho, 0);
  const nome = (id: string) => d.unidadePorId.get(id)?.nome ?? id;

  const alternar = (id: string) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function abrir(a: Anexo) {
    const janela = window.open('', '_blank');
    if (janela) janela.opener = null;
    try {
      const url = await d.abrirAnexo(a);
      if (janela) janela.location.href = url;
      else window.location.assign(url);
    } catch (e) {
      janela?.close();
      avisar('Não foi possível abrir: ' + (e as Error).message, 'erro');
    }
  }

  async function excluir() {
    setExcluindo(true);
    let feitos = 0;
    const falhas: string[] = [];
    for (const { anexo } of escolhidos) {
      try {
        await d.excluirAnexo(anexo);
        feitos++;
      } catch (e) {
        falhas.push(`${anexo.nome}: ${(e as Error).message}`);
      }
    }
    setMarcados(new Set());
    setExcluindo(false);
    setConfirmando(false);
    if (feitos) avisar(`${feitos} PDF(s) excluído(s).`);
    if (falhas.length) avisar(`Não foi possível excluir ${falhas.length}: ${falhas[0]}`, 'erro', 8000);
  }

  return (
    <section className="cartao">
      <div className="cartao__cab">
        <h2 className="titulo-bloco">PDFs enviados que já estão no Diário ou no CME</h2>
        <span className="contagem">{todos.length} PDFs</span>
      </div>
      <div className="cartao__corpo" style={{ display: 'grid', gap: 12 }}>
        <p className="texto-muted pequeno" style={{ margin: 0 }}>
          São PDFs que foram enviados à mão, mas a unidade já tem o mesmo tipo de ato como link <strong>confirmado</strong> do CME ou do Diário Oficial (com
          número de edição). Abra o PDF e o link, marque os que são o mesmo documento e exclua para liberar espaço no banco. <strong>Excluir não tem volta.</strong>
        </p>
        {d.anexosErro && <Nota tipo="alerta">{d.anexosErro}</Nota>}
        {todos.length === 0 ? (
          <p className="texto-muted">
            {d.anexos.length === 0 ? 'Nenhum PDF enviado neste banco.' : 'Nenhum PDF enviado tem um link equivalente confirmado do CME ou do Diário.'}
          </p>
        ) : (
          <>
            <div className="varredura__botoes">
              <button type="button" className="btn btn--neutro btn--pequeno" onClick={() => setMarcados(new Set(filtrados.map((x) => x.anexo.id)))}>
                Marcar todos{filtrados.length !== todos.length ? ' da busca' : ''}
              </button>
              <button type="button" className="btn btn--neutro btn--pequeno" disabled={marcados.size === 0} onClick={() => setMarcados(new Set())}>
                Limpar seleção
              </button>
              <button type="button" className="btn btn--perigo btn--pequeno" disabled={escolhidos.length === 0 || excluindo} onClick={() => setConfirmando(true)}>
                <Trash2 size={14} aria-hidden /> Excluir selecionados ({escolhidos.length})
              </button>
              {escolhidos.length > 0 && <small className="texto-muted">até {formatarTamanho(bytes)}</small>}
            </div>
            {lista.length === 0 ? (
              <p className="texto-muted">Nenhum PDF para esta busca.</p>
            ) : (
              <div className="tabela-wrap">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>
                        <span className="sr-only">Selecionar</span>
                      </th>
                      <th>Unidade</th>
                      <th>PDF enviado</th>
                      <th>Já está como link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map(({ anexo, fonte, equivalentes }) => (
                      <tr key={anexo.id}>
                        <td>
                          <input type="checkbox" checked={marcados.has(anexo.id)} onChange={() => alternar(anexo.id)} aria-label={`Selecionar ${anexo.nome}`} />
                        </td>
                        <td>
                          <Link to={`/unidades/${anexo.entidade_id}`}>{nome(anexo.entidade_id)}</Link>
                          <br />
                          <small className="texto-muted">{anexo.entidade_id}</small>
                        </td>
                        <td>
                          <strong className="pequeno">{anexo.nome}</strong>
                          <br />
                          <small className="texto-muted">
                            {anexo.categoria} · {formatarTamanho(anexo.tamanho)}
                            {anexo.criado_em ? ` · enviado em ${formatarData(anexo.criado_em.slice(0, 10))}` : ''}
                          </small>
                          <br />
                          <button type="button" className="btn btn--contorno btn--pequeno" onClick={() => void abrir(anexo)}>
                            <ExternalLink size={14} aria-hidden /> Abrir PDF
                          </button>
                        </td>
                        <td>
                          <span className="chip chip--azul">{fonte === 'cme' ? 'CME' : 'Diário Oficial'}</span>
                          {equivalentes.slice(0, 4).map((e) => (
                            <div key={e.titulo + e.url} className="pequeno">
                              <a href={e.url} target="_blank" rel="noopener noreferrer">
                                {e.titulo}
                              </a>
                              <br />
                              <small className="texto-muted">{e.referencia}</small>
                            </div>
                          ))}
                          {equivalentes.length > 4 && <small className="texto-muted">e mais {equivalentes.length - 4}</small>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {filtrados.length > lista.length && (
              <p style={{ margin: 0 }}>
                <button type="button" className="btn btn--neutro btn--pequeno" onClick={() => setQuantos((q) => q + PAGINA)}>
                  Mostrar mais {Math.min(PAGINA, filtrados.length - lista.length)} (restam {filtrados.length - lista.length})
                </button>
              </p>
            )}
          </>
        )}
      </div>

      {confirmando && (
        <Dialogo titulo="Excluir PDFs" confirmar={excluindo ? 'Excluindo…' : `Excluir ${escolhidos.length} PDF(s)`} perigo aoFechar={() => !excluindo && setConfirmando(false)} aoConfirmar={() => void excluir()}>
          <p>
            Vão ser excluídos <strong>{escolhidos.length}</strong> PDF(s) enviados, ocupando até {formatarTamanho(bytes)}. O ato continua disponível pelo link do CME ou do Diário
            Oficial. <strong>Não dá para desfazer.</strong> Confirma que você conferiu que são o mesmo documento?
          </p>
        </Dialogo>
      )}
    </section>
  );
}
