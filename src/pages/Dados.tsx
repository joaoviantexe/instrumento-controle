import { useRef, useState } from 'react';
import { Cloud, DatabaseBackup, Download, FileSpreadsheet, HardDrive, RotateCcw, Upload } from 'lucide-react';
import { Dialogo, Faixa, Nota } from '../components/ui';
import { useDados } from '../lib/store';
import { useSessao } from '../lib/sessao';
import { SUPABASE_URL } from '../lib/backend/supabase';
import { snapshotInicial } from '../lib/backend/inicial';
import { baixar, exportarExcel } from '../lib/exportar';
import { abaAcoes, abaAuditoriaDocumental, abaListaMestra, abaPlano, abaUnidades, abasRelatorios } from '../lib/abas';
import { avisar } from '../lib/avisos';
import { hojeISO } from '../lib/format';
import { PLANILHA } from '../data/planilha';
import type { Snapshot } from '../lib/types';

const ORIGEM = 'instrumento-cde';

function validar(json: unknown): Snapshot {
  const dados = (json as { origem?: string; dados?: Snapshot })?.dados;
  if ((json as { origem?: string })?.origem !== ORIGEM || !dados) throw new Error('Arquivo não reconhecido.');
  for (const k of ['unidades', 'auditorias', 'avaliacoes', 'acoes'] as const) {
    if (!Array.isArray(dados[k])) throw new Error(`Arquivo incompleto: ${k}.`);
  }
  return { unidades: dados.unidades, auditorias: dados.auditorias, avaliacoes: dados.avaliacoes, acoes: dados.acoes };
}

export function Dados() {
  const d = useDados();
  const { email } = useSessao();
  const arquivo = useRef<HTMLInputElement>(null);
  const [pendente, setPendente] = useState<{ titulo: string; texto: string; dados: Snapshot } | null>(null);
  const [processando, setProcessando] = useState(false);
  const vazio = d.unidades.length === 0;

  function baixarBackup() {
    const conteudo = {
      origem: ORIGEM,
      versao: 1,
      gerado_em: new Date().toISOString(),
      dados: { unidades: d.unidades, auditorias: d.auditorias, avaliacoes: d.avaliacoes, acoes: d.acoes },
    };
    baixar(new Blob([JSON.stringify(conteudo, null, 1)], { type: 'application/json' }), `backup_instrumento_cde_${hojeISO()}.json`);
    avisar('Cópia de segurança gerada.');
  }

  async function lerArquivo(f: File) {
    try {
      const dados = validar(JSON.parse(await f.text()));
      setPendente({
        titulo: 'Restaurar cópia de segurança',
        texto: `O arquivo "${f.name}" contém ${dados.unidades.length} unidades, ${dados.auditorias.length} auditorias, ${dados.avaliacoes.length} registros da Auditoria Documental e ${dados.acoes.length} ações. Todos os dados atuais serão substituídos.`,
        dados,
      });
    } catch (e) {
      avisar('Não foi possível ler o arquivo: ' + (e as Error).message, 'erro');
    } finally {
      if (arquivo.current) arquivo.current.value = '';
    }
  }

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
      <Faixa titulo="Dados e backup" sub="Exportação para Excel, cópia de segurança e restauração." />
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
                    banco compartilhado gratuito (Supabase), conforme o guia de implantação. Faça cópias de segurança com
                    frequência: limpar os dados do navegador apaga as informações.
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

        <div className="grade-3">
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
              <h2 className="titulo-bloco">Cópia de segurança</h2>
              <DatabaseBackup size={22} aria-hidden style={{ color: 'var(--verde-texto)' }} />
            </div>
            <div className="cartao__corpo" style={{ display: 'grid', gap: 14 }}>
              <p className="texto-muted pequeno">
                Arquivo .json com todos os registros. Serve para guardar o histórico, transferir os dados para outro
                computador ou migrar do modo local para o banco compartilhado.
              </p>
              <button type="button" className="btn btn--primario" onClick={baixarBackup}>
                <Download size={16} aria-hidden /> Baixar cópia
              </button>
              <button type="button" className="btn btn--neutro" onClick={() => arquivo.current?.click()} disabled={processando}>
                <Upload size={16} aria-hidden /> Restaurar cópia
              </button>
              <input
                ref={arquivo}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => e.target.files?.[0] && void lerArquivo(e.target.files[0])}
              />
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
                      : 'Todos os dados atuais serão substituídos pelo conteúdo original da planilha. Recomenda-se baixar uma cópia de segurança antes.',
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
