import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus, Search } from 'lucide-react';
import { CampoSelect, Etiqueta, Faixa, Nota, Th, Vazio, ordenar, useOrdenacao, useRotulosCartao } from '../components/ui';
import { FormUnidade, unidadeVazia } from '../components/FormUnidade';
import { CABECALHOS_UNIDADE as C, DISTRITOS, OPCOES_CADASTRO, SITUACOES_UNIDADE, TEXTOS } from '../data/planilha';
import { useDados } from '../lib/store';
import { contem, formatarData } from '../lib/format';
import { vigenciaVencida } from '../lib/calc';
import { PENDENCIAS } from '../lib/pendencias';
import { exportarExcel } from '../lib/exportar';
import { abaUnidades } from '../lib/abas';
import { avisar } from '../lib/avisos';

type Campo = 'distrito' | 'inep' | 'nome' | 'rede' | 'tipo_unidade' | 'vigencia_ato' | 'diretor' | 'data_atualizacao';

export function Unidades() {
  const d = useDados();
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const [nova, setNova] = useState(false);
  const { ordem, alternar } = useOrdenacao<Campo>('distrito');
  const tabela = useRotulosCartao();

  const f = {
    busca: params.get('busca') ?? '',
    distrito: params.get('distrito') ?? '',
    bairro: params.get('bairro') ?? '',
    rede: params.get('rede') ?? '',
    tipo: params.get('tipo') ?? '',
    zona: params.get('zona') ?? '',
    situacao: params.get('situacao') ?? '',
    pendencia: params.get('pendencia') ?? '',
  };
  const setF = (k: keyof typeof f) => (v: string) =>
    setParams(
      (p) => {
        if (v) p.set(k, v);
        else p.delete(k);
        if (k === 'distrito') p.delete('bairro');
        return p;
      },
      { replace: true },
    );

  const contagemDistrito = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of d.unidades) m.set(u.distrito, (m.get(u.distrito) ?? 0) + 1);
    return m;
  }, [d.unidades]);

  const bairros = useMemo(
    () =>
      Array.from(new Set(d.unidades.filter((u) => !f.distrito || u.distrito === f.distrito).map((u) => u.bairro)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [d.unidades, f.distrito],
  );

  const pendencia = PENDENCIAS.find((p) => p.chave === f.pendencia);
  const filtradas = useMemo(() => {
    const lista = d.unidades.filter(
      (u) =>
        (!f.distrito || u.distrito === f.distrito) &&
        (!f.bairro || u.bairro === f.bairro) &&
        (!f.rede || u.rede === f.rede) &&
        (!f.tipo || u.tipo_unidade === f.tipo) &&
        (!f.zona || u.zona === f.zona) &&
        (!f.situacao || u.situacao === f.situacao) &&
        (!pendencia || pendencia.teste(u)) &&
        (!f.busca ||
          [u.nome, u.inep, u.bairro, u.endereco, u.diretor, u.secretario, u.email].some((v) => contem(v, f.busca))),
    );
    return ordenar(lista, (u) => (ordem.campo === 'distrito' ? `${u.distrito} ${u.bairro} ${u.nome}` : u[ordem.campo]), ordem.direcao);
  }, [d.unidades, f.distrito, f.bairro, f.rede, f.tipo, f.zona, f.situacao, f.busca, pendencia, ordem]);

  const limpar = () => setParams({}, { replace: true });
  const filtrando = Object.values(f).some(Boolean);

  return (
    <>
      <Faixa titulo="Cadastro Unidades" sub={TEXTOS.cadastro.subtitulo}>
        <button type="button" className="btn btn--claro" onClick={() => setNova(true)}>
          <Plus size={16} aria-hidden /> Nova unidade
        </button>
      </Faixa>
      <div className="container pagina">
        <Nota>
          <strong>{TEXTOS.instrucoes.passos[0].titulo}.</strong> {TEXTOS.instrucoes.passos[0].descricao}
        </Nota>

        <div className="pilulas" role="group" aria-label={C.distrito}>
          <button type="button" className="pilula" aria-pressed={!f.distrito} onClick={() => setF('distrito')('')}>
            Todos <b>{d.unidades.length}</b>
          </button>
          {DISTRITOS.map((dist) => (
            <button
              type="button"
              key={dist}
              className="pilula"
              aria-pressed={f.distrito === dist}
              onClick={() => setF('distrito')(f.distrito === dist ? '' : dist)}
            >
              {dist} <b>{contagemDistrito.get(dist) ?? 0}</b>
            </button>
          ))}
        </div>

        <section className="cartao">
          <div className="cartao__corpo" style={{ display: 'grid', gap: 12 }}>
            <div className="ferramentas">
              <label className="busca">
                <span className="sr-only">Buscar</span>
                <Search size={18} aria-hidden />
                <input
                  type="search"
                  placeholder={`${C.nome}, ${C.inep}, ${C.bairro}, ${C.endereco}, ${C.diretor}…`}
                  value={f.busca}
                  onChange={(e) => setF('busca')(e.target.value)}
                />
              </label>
              <div className="ferramentas__direita">
                {filtrando && (
                  <button type="button" className="btn btn--neutro" onClick={limpar}>
                    Limpar filtros
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--contorno"
                  onClick={() => void exportarExcel('Cadastro_Unidades', [abaUnidades(filtradas)])}
                >
                  <Download size={16} aria-hidden /> Exportar Excel
                </button>
              </div>
            </div>
            <div className="ferramentas">
              <CampoSelect classe="campo--filtro" rotulo={C.bairro} valor={f.bairro} aoMudar={setF('bairro')} opcoes={bairros} vazio="Todos" />
              <CampoSelect classe="campo--filtro" rotulo={C.rede} valor={f.rede} aoMudar={setF('rede')} opcoes={OPCOES_CADASTRO.rede} vazio="Todos" />
              <CampoSelect
                classe="campo--filtro"
                rotulo={C.tipo_unidade}
                valor={f.tipo}
                aoMudar={setF('tipo')}
                opcoes={OPCOES_CADASTRO.tipo_unidade}
                vazio="Todos"
              />
              <CampoSelect classe="campo--filtro" rotulo={C.zona} valor={f.zona} aoMudar={setF('zona')} opcoes={OPCOES_CADASTRO.zona} vazio="Todas" />
              <CampoSelect
                classe="campo--filtro"
                rotulo={C.situacao}
                valor={f.situacao}
                aoMudar={setF('situacao')}
                opcoes={SITUACOES_UNIDADE}
                vazio="Todas"
              />
              <CampoSelect
                classe="campo--filtro"
                rotulo="Pendências cadastrais"
                valor={f.pendencia}
                aoMudar={setF('pendencia')}
                opcoes={PENDENCIAS.map((p) => ({ valor: p.chave, rotulo: p.rotulo }))}
                vazio="—"
              />
            </div>
            <p className="contagem" aria-live="polite">
              {filtradas.length} de {d.unidades.length} unidades
            </p>
          </div>
          <div className="tabela-wrap tabela-wrap--alta">
            <table className="tabela tabela--cartoes" ref={tabela}>
              <thead>
                <tr>
                  <Th campo="distrito" ordem={ordem} alternar={alternar}>
                    {C.distrito} / {C.bairro}
                  </Th>
                  <Th campo="inep" ordem={ordem} alternar={alternar}>
                    {C.inep}
                  </Th>
                  <Th campo="nome" ordem={ordem} alternar={alternar}>
                    {C.nome}
                  </Th>
                  <Th campo="rede" ordem={ordem} alternar={alternar}>
                    {C.rede}
                  </Th>
                  <Th campo="tipo_unidade" ordem={ordem} alternar={alternar}>
                    {C.tipo_unidade}
                  </Th>
                  <Th campo="vigencia_ato" ordem={ordem} alternar={alternar}>
                    {C.vigencia_ato}
                  </Th>
                  <Th campo="diretor" ordem={ordem} alternar={alternar}>
                    {C.diretor}
                  </Th>
                  <Th campo="data_atualizacao" ordem={ordem} alternar={alternar}>
                    {C.data_atualizacao}
                  </Th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((u) => (
                  <tr
                    key={u.id}
                    className="clicavel"
                    onClick={() => navegar(`/unidades/${u.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navegar(`/unidades/${u.id}`)}
                    tabIndex={0}
                  >
                    <td style={{ minWidth: 120 }}>
                      <strong>{u.distrito}</strong>
                      <div className="pequeno texto-muted">{u.bairro}</div>
                    </td>
                    <td className="nowrap">{u.inep}</td>
                    <td className="larga forte principal">{u.nome}</td>
                    <td className="nowrap">{u.rede}</td>
                    <td>{u.tipo_unidade}</td>
                    <td className="nowrap">
                      {vigenciaVencida(u.vigencia_ato) ? (
                        <span className="chip chip--nc" title={`${C.vigencia_ato}: vencida`}>
                          {formatarData(u.vigencia_ato)}
                        </span>
                      ) : (
                        formatarData(u.vigencia_ato) || <Etiqueta valor="" />
                      )}
                    </td>
                    <td className="media">{u.diretor || <span className="texto-muted">—</span>}</td>
                    <td className="nowrap">{formatarData(u.data_atualizacao) || <span className="texto-muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtradas.length === 0 && (
              <Vazio texto="Nenhuma unidade encontrada.">
                {filtrando && (
                  <button type="button" className="btn btn--contorno btn--pequeno" onClick={limpar}>
                    Limpar filtros
                  </button>
                )}
              </Vazio>
            )}
          </div>
        </section>
      </div>
      {nova && (
        <FormUnidade
          inicial={unidadeVazia()}
          aoFechar={() => setNova(false)}
          aoSalvar={async (u) => {
            const id = crypto.randomUUID();
            await d.salvarUnidade({ ...u, id });
            avisar('Unidade cadastrada.');
            navegar(`/unidades/${id}`);
          }}
        />
      )}
    </>
  );
}
