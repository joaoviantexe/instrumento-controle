import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import { Dialogo, Etiqueta, Faixa, Nota } from '../components/ui';
import { FormUnidade, GRUPOS_UNIDADE } from '../components/FormUnidade';
import { FormAuditoria, auditoriaVazia } from '../components/FormAuditoria';
import { Anexos } from '../components/Anexos';
import { AtosDiario } from '../components/AtosDiario';
import { ResolucoesCme } from '../components/ResolucoesCme';
import { SecretariaEscolar } from '../components/SecretariaEscolar';
import { SituacaoDocumentos } from '../components/SituacaoDocumentos';
import { CABECALHOS_UNIDADE as C } from '../data/planilha';
import { useDados } from '../lib/store';
import { formatarCep, formatarData, formatarTelefone } from '../lib/format';
import { vigenciaVencida } from '../lib/calc';
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
  const { hash } = useLocation();
  // Links para uma seção da página (ex.: #checklist-secretaria, vindo de Dados e planilhas).
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' });
  }, [hash, id]);
  if (!u) return <NaoEncontrada />;

  const auditorias = d.auditorias.filter((a) => a.unidade_id === id).sort((a, b) => b.id.localeCompare(a.id));

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

        <section className="cartao" aria-labelledby="resolucoes-cme">
          <div className="cartao__cab">
            <h2 id="resolucoes-cme" className="titulo-bloco">
              Resoluções do CME
            </h2>
            <span className="contagem">Autorização, renovação e credenciamento, com o PDF no site do Conselho</span>
          </div>
          <div className="cartao__corpo">
            <ResolucoesCme unidadeId={u.id} />
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

        <section className="cartao" aria-labelledby="situacao-documentos">
          <div className="cartao__cab">
            <h2 id="situacao-documentos" className="titulo-bloco">
              Situação dos documentos da auditoria
            </h2>
            <span className="contagem">Avaliados, conformes e o que requer verificação da CDE</span>
          </div>
          <div className="cartao__corpo">
            <SituacaoDocumentos unidadeId={u.id} />
          </div>
        </section>

        <SecretariaEscolar unidade={u} />

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
            aoConfirmar={() => navegar(`/plano-de-visita-tecnica?unidade=${u.id}`)}
            aoFechar={() => setExcluindo(false)}
          >
            <Nota tipo="alerta">
              Esta unidade possui {auditorias.length} registro(s) no Plano de Visita Técnica. Exclua-os antes de excluir a
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
