import { useRef, useState, type DragEvent } from 'react';
import { CheckCircle2, FileUp, TriangleAlert } from 'lucide-react';
import { avisar } from '../lib/avisos';
import { useDados } from '../lib/store';
import { lerPlanilha, planejarImportacao, registrosParaGravar, totalMudancas, type Plano, type ResumoTabela } from '../lib/importar';
import { Nota } from './ui';

const TABELAS = [
  { chave: 'unidades', nome: 'Cadastro Unidades' },
  { chave: 'auditorias', nome: 'Plano de Visita Técnica' },
  { chave: 'avaliacoes', nome: 'Auditoria Documental' },
  { chave: 'acoes', nome: 'Plano de Ação' },
] as const;

/** Atualiza os dados a partir de uma planilha Excel: mostra o que muda e só grava após a confirmação. */
export function ImportarPlanilha() {
  const d = useDados();
  const entrada = useRef<HTMLInputElement>(null);
  const [plano, setPlano] = useState<(Plano & { arquivo: string }) | null>(null);
  const [lendo, setLendo] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);

  async function ler(f: File) {
    setLendo(true);
    setPlano(null);
    try {
      if (!/\.xlsx$/i.test(f.name)) throw new Error('envie um arquivo do Excel (.xlsx).');
      const p = planejarImportacao(await lerPlanilha(f), { unidades: d.unidades, auditorias: d.auditorias, avaliacoes: d.avaliacoes, acoes: d.acoes });
      if (!TABELAS.some((t) => p[t.chave].encontrada)) throw new Error('nenhuma aba da planilha foi reconhecida.');
      setPlano({ ...p, arquivo: f.name });
    } catch (e) {
      avisar('Não foi possível ler a planilha: ' + (e as Error).message, 'erro');
    } finally {
      setLendo(false);
      if (entrada.current) entrada.current.value = '';
    }
  }

  async function aplicar() {
    if (!plano) return;
    setAplicando(true);
    try {
      await d.importarRegistros(registrosParaGravar(plano));
      avisar('Dados atualizados com a planilha.');
      setPlano(null);
    } catch (e) {
      avisar('Falha ao atualizar: ' + (e as Error).message, 'erro');
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

  const total = plano ? totalMudancas(plano) : 0;

  return (
    <section className="cartao">
      <div className="cartao__cab">
        <h2 className="titulo-bloco">Atualizar dados com uma planilha</h2>
        <FileUp size={22} aria-hidden style={{ color: 'var(--verde-texto)' }} />
      </div>
      <div className="cartao__corpo" style={{ display: 'grid', gap: 14 }}>
        <p className="texto-muted pequeno">
          Envie a planilha atualizada (a original ou uma gerada por <strong>Exportar Excel</strong>). O sistema reconhece as abas
          Cadastro Unidades, Plano de Visita Técnica (ou Plano de Auditoria, nas planilhas antigas), Auditoria Documental e Plano de Ação, compara com os dados atuais e mostra o que
          será criado e alterado antes de gravar. As unidades são identificadas pelo INEP (ou pelo nome), as auditorias e as ações
          pelo ID. <strong>Nada é excluído</strong>: registros que não estiverem na planilha permanecem como estão.
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
          <span>Arraste a planilha (.xlsx) para cá ou</span>
          <button type="button" className="btn btn--primario btn--pequeno" disabled={lendo || aplicando} onClick={() => entrada.current?.click()}>
            {lendo ? 'Lendo…' : 'Escolher planilha'}
          </button>
          <input ref={entrada} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => e.target.files?.[0] && void ler(e.target.files[0])} />
        </div>

        {plano && (
          <div className="importacao">
            <strong>{plano.arquivo}</strong>
            <table className="tabela tabela--compacta">
              <thead>
                <tr>
                  <th>Aba</th>
                  <th>Linhas lidas</th>
                  <th>Novos</th>
                  <th>Alterados</th>
                  <th>Sem mudança</th>
                </tr>
              </thead>
              <tbody>
                {TABELAS.map((t) => {
                  const r = plano[t.chave] as ResumoTabela<object>;
                  return (
                    <tr key={t.chave}>
                      <td>{t.nome}</td>
                      {r.encontrada ? (
                        <>
                          <td>{r.lidas}</td>
                          <td>{r.novos.length}</td>
                          <td>
                            {r.alterados.length > 0 ? (
                              <button type="button" className="link-botao" onClick={() => setAberta(aberta === t.chave ? null : t.chave)}>
                                {r.alterados.length} {aberta === t.chave ? '▾' : '▸'}
                              </button>
                            ) : (
                              0
                            )}
                          </td>
                          <td>{r.iguais}</td>
                        </>
                      ) : (
                        <td colSpan={4} className="texto-muted">
                          aba não encontrada no arquivo
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {aberta && (
              <ul className="importacao__mudancas">
                {(plano[aberta as keyof Plano] as ResumoTabela<{ id?: string; nome?: string }>).alterados.slice(0, 40).map((a, i) => (
                  <li key={i}>
                    <strong>{a.antes.nome ?? a.antes.id ?? (a.antes as { auditoria_id?: string }).auditoria_id}</strong>
                    <ul>
                      {a.campos.map((c) => (
                        <li key={c.rotulo}>
                          {c.rotulo}: <s>{c.de || '(vazio)'}</s> → <b>{c.para || '(vazio)'}</b>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
                {(plano[aberta as keyof Plano] as ResumoTabela<object>).alterados.length > 40 && <li>… e mais alterações.</li>}
              </ul>
            )}

            {plano.avisos.length > 0 && (
              <Nota tipo="alerta">
                <TriangleAlert size={14} aria-hidden /> <strong>{plano.avisos.length} aviso(s):</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {plano.avisos.slice(0, 8).map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                  {plano.avisos.length > 8 && <li>… e mais {plano.avisos.length - 8}.</li>}
                </ul>
              </Nota>
            )}

            {total === 0 ? (
              <Nota>
                <CheckCircle2 size={14} aria-hidden /> A planilha não traz nenhuma diferença em relação aos dados atuais.
              </Nota>
            ) : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn--verde" disabled={aplicando} onClick={() => void aplicar()}>
                  {aplicando ? 'Atualizando…' : `Aplicar ${total} alteraç${total === 1 ? 'ão' : 'ões'}`}
                </button>
                <button type="button" className="btn btn--neutro" disabled={aplicando} onClick={() => setPlano(null)}>
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
