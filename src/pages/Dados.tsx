import { useState } from 'react';
import { Cloud, Download, FileSpreadsheet, HardDrive, RotateCcw } from 'lucide-react';
import { ImportarPlanilha } from '../components/ImportarPlanilha';
import { Dialogo, Faixa, Nota } from '../components/ui';
import { useDados } from '../lib/store';
import { useSessao } from '../lib/sessao';
import { SUPABASE_URL } from '../lib/backend/supabase';
import { snapshotInicial } from '../lib/backend/inicial';
import { exportarExcel } from '../lib/exportar';
import { abaAcoes, abaAuditoriaDocumental, abaListaMestra, abaPlano, abaUnidades, abasRelatorios } from '../lib/abas';
import { avisar } from '../lib/avisos';
import { PLANILHA } from '../data/planilha';
import type { Snapshot } from '../lib/types';

export function Dados() {
  const d = useDados();
  const { email } = useSessao();
  const [pendente, setPendente] = useState<{ titulo: string; texto: string; dados: Snapshot } | null>(null);
  const [processando, setProcessando] = useState(false);
  const vazio = d.unidades.length === 0;
  async function substituir(dados: Snapshot) {
    setProcessando(true);
    try {
      await d.substituirTudo(dados);
      avisar('Dados restaurados.');
    } catch (e) {
      avisar('Falha ao restaurar: ' + (e as Error).message, 'erro');
    } finally {
      setProcessando(false);
    }
  }

  function exportarTudo() {
    void exportarExcel('Instrumento_Controle_Documentacao_Escolar_CDE_SEMEC', [
      abaUnidades(d.unidades),
      abaListaMestra(),
      abaPlano(d, d.auditorias),
      abaAuditoriaDocumental(d, d.auditorias),
      abaAcoes(d, d.acoes),
      ...abasRelatorios(d, d.linhas, d.unidades, d.auditorias),
    ]);
  }

  return (
    <>
      <Faixa titulo="Dados e planilhas" sub="Exportação para Excel e atualização dos dados por planilha." />
      <div className="container pagina">
        {vazio && (
          <Nota tipo="alerta">
            O banco de dados está vazio. Use <strong>Carregar dados da planilha</strong> abaixo para importar as{' '}
            {PLANILHA.unidades.length} unidades e as {PLANILHA.auditorias.length} auditorias da planilha original.
          </Nota>
        )}

        <section className="cartao">
          <div className="cartao__cab">
            <h2 className="titulo-bloco">Armazenamento</h2>
          </div>
          <div className="cartao__corpo" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            {d.modo === 'supabase' ? (
              <>
                <Cloud size={32} aria-hidden style={{ color: 'var(--azul-sec)', flexShrink: 0 }} />
                <div>
                  <strong>Banco compartilhado (Supabase)</strong>
                  <p className="texto-muted">
                    Os dados ficam no banco do projeto <code>{new URL(SUPABASE_URL).hostname}</code> e são compartilhados por
                    toda a equipe autorizada. Sessão atual: {email}.
                  </p>
                </div>
              </>
            ) : (
              <>
                <HardDrive size={32} aria-hidden style={{ color: 'var(--azul-sec)', flexShrink: 0 }} />
                <div>
                  <strong>Modo local</strong>
                  <p className="texto-muted">
                    Os dados ficam salvos somente neste navegador, neste computador. Para trabalhar em equipe, configure o
                    banco compartilhado gratuito (Supabase), conforme o guia de implantação. Exporte para Excel com frequência:
                    limpar os dados do navegador apaga as informações.
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

        <ImportarPlanilha />

        <div className="grade-2">
          <section className="cartao">
            <div className="cartao__cab">
              <h2 className="titulo-bloco">Planilha completa</h2>
              <FileSpreadsheet size={22} aria-hidden style={{ color: 'var(--verde-texto)' }} />
            </div>
            <div className="cartao__corpo" style={{ display: 'grid', gap: 14 }}>
              <p className="texto-muted pequeno">
                Gera um arquivo .xlsx com as abas Cadastro Unidades, Lista Mestra, Plano de Auditoria, Auditoria Documental,
                Plano de Ação e Relatórios, com os mesmos cabeçalhos da planilha original.
              </p>
              <button type="button" className="btn btn--primario" onClick={exportarTudo}>
                <Download size={16} aria-hidden /> Exportar Excel
              </button>
            </div>
          </section>

          <section className="cartao">
            <div className="cartao__cab">
              <h2 className="titulo-bloco">Dados da planilha</h2>
              <RotateCcw size={22} aria-hidden style={{ color: 'var(--perigo)' }} />
            </div>
            <div className="cartao__corpo" style={{ display: 'grid', gap: 14 }}>
              <p className="texto-muted pequeno">
                Recarrega o conteúdo original de <em>{PLANILHA.fonte}</em>: {PLANILHA.unidades.length} unidades e{' '}
                {PLANILHA.auditorias.length} auditorias. Avaliações e ações registradas são apagadas.
              </p>
              <button
                type="button"
                className={vazio ? 'btn btn--verde' : 'btn btn--perigo'}
                disabled={processando}
                onClick={() =>
                  setPendente({
                    titulo: vazio ? 'Carregar dados da planilha' : 'Restaurar dados originais',
                    texto: vazio
                      ? 'Os dados da planilha original serão carregados no banco.'
                      : 'Todos os dados atuais serão substituídos pelo conteúdo original da planilha. Recomenda-se exportar o Excel antes.',
                    dados: snapshotInicial(),
                  })
                }
              >
                <RotateCcw size={16} aria-hidden /> {vazio ? 'Carregar dados da planilha' : 'Restaurar dados originais'}
              </button>
            </div>
          </section>
        </div>
      </div>

      {pendente && (
        <Dialogo
          titulo={pendente.titulo}
          confirmar="Confirmar"
          perigo={!vazio}
          aoFechar={() => setPendente(null)}
          aoConfirmar={() => void substituir(pendente.dados)}
        >
          <p>{pendente.texto}</p>
        </Dialogo>
      )}
    </>
  );
}
