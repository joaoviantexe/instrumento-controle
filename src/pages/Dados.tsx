import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardCheck, Cloud, Download, FileSpreadsheet, HardDrive, Landmark, Paperclip, RotateCcw, Users } from 'lucide-react';
import { ConferenciaAtos } from '../components/ConferenciaAtos';
import { PanoramaTurmas } from '../components/PanoramaTurmas';
import { ImportarPlanilha } from '../components/ImportarPlanilha';
import { VarreduraDiario } from '../components/VarreduraDiario';
import { MARGEM_BLOQUEIO, formatarTamanho, limiteArmazenamentoBytes, resumirAnexos } from '../lib/anexos';
import { formatarPct } from '../lib/format';
import { Dialogo, Faixa, Nota } from '../components/ui';
import { useDados } from '../lib/store';
import { useSessao } from '../lib/sessao';
import { SUPABASE_URL } from '../lib/backend/supabase';
import { snapshotInicial } from '../lib/backend/inicial';
import { exportarExcel } from '../lib/exportar';
import { abaAcoes, abaAuditoriaDocumental, abaAuditoriaTurmas, abaListaMestra, abaPlano, abaUnidades, abasRelatorios } from '../lib/abas';
import { avisar } from '../lib/avisos';
import { PLANILHA } from '../data/planilha';
import type { Snapshot } from '../lib/types';

const env = import.meta.env as unknown as Record<string, string | undefined>;
const LIMITE_A = Number(env.VITE_LIMITE_GRAVACOES) || 900000;
const LIMITE_B = Number(env.VITE_LIMITE_LEITURAS) || 9000000;

export function Dados() {
  const d = useDados();
  const { email } = useSessao();
  const [pendente, setPendente] = useState<{ titulo: string; texto: string; dados: Snapshot } | null>(null);
  const [processando, setProcessando] = useState(false);
  const vazio = d.unidades.length === 0;
  const [uso, setUso] = useState<{ A: number; B: number } | null>(null);
  useEffect(() => {
    if (d.destinoAnexos === 'r2') void d.usoOperacoes().then(setUso);
  }, [d.destinoAnexos, d.anexos.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const noR2SemConfig = d.destinoAnexos !== 'r2' && d.anexos.some((a) => a.destino === 'r2');
  const pendentesR2 = d.destinoAnexos === 'r2' ? new Set(d.anexos.filter((a) => a.destino !== 'r2' && a.hash).map((a) => a.hash)).size : 0;

  async function migrar() {
    setProcessando(true);
    try {
      const r = await d.migrarAnexos();
      avisar(
        r.parouPor
          ? `Migração interrompida: ${r.parouPor}. ${r.movidos} arquivo(s) movido(s); restam ${r.restantes}.`
          : `${r.movidos} arquivo(s) movido(s) para o Cloudflare R2.`,
        r.parouPor ? 'erro' : 'sucesso',
      );
    } catch (e) {
      avisar('Falha na migração: ' + (e as Error).message, 'erro');
    } finally {
      setProcessando(false);
    }
  }
  const espaco = resumirAnexos(d.anexos);
  const limite = limiteArmazenamentoBytes();
  const usado = Math.min(1, espaco.bytesUsados / limite);
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
      abaAuditoriaTurmas(d),
      abaAcoes(d, d.acoes),
      ...abasRelatorios(d, d.linhas, d.unidades, d.auditorias),
    ]);
  }

  const [params, setParams] = useSearchParams();
  const aba = (['planilhas', 'turmas', 'anexos', 'diario', 'atos', 'avancado'] as const).find((x) => x === params.get('aba')) ?? 'planilhas';
  const irPara = (x: string) => setParams(x === 'planilhas' ? {} : { aba: x }, { replace: true });
  const alertaEspaco = usado >= MARGEM_BLOQUEIO ? 'bloqueado' : usado >= 0.8 ? 'atencao' : null;

  const restaurar = () =>
    setPendente({
      titulo: vazio ? 'Carregar dados da planilha' : 'Restaurar dados originais',
      texto: vazio
        ? 'Os dados da planilha original serão carregados no banco.'
        : 'Todos os dados atuais serão substituídos pelo conteúdo original da planilha. Recomenda-se exportar o Excel antes.',
      dados: snapshotInicial(),
    });

  const Barra = ({ f, rotulo, detalhe }: { f: number; rotulo: string; detalhe: string }) => (
    <div className="medicao">
      <div className="medicao__topo">
        <span>{rotulo}</span>
        <span>
          <strong>{formatarPct(f)}</strong> usado · <strong>{formatarPct(1 - f)}</strong> disponível
        </span>
      </div>
      <div className="armazenamento__trilho" role="img" aria-label={`${rotulo}: ${formatarPct(f)} usado`}>
        <div className={'armazenamento__barra' + (f >= 0.8 ? ' armazenamento__barra--alerta' : '')} style={{ width: `${Math.max(f * 100, f > 0 ? 1 : 0)}%` }} />
      </div>
      <small className="texto-muted">{detalhe}</small>
    </div>
  );

  return (
    <>
      <Faixa titulo="Dados e planilhas" sub="Exportar e atualizar os dados por planilha, acompanhar os anexos em PDF e gerenciar o armazenamento." />
      <div className="container pagina">
        {vazio && (
          <Nota tipo="alerta">
            O banco de dados está vazio. Em <strong>Avançado</strong>, use <strong>Carregar dados da planilha</strong> para importar as{' '}
            {PLANILHA.unidades.length} unidades e as {PLANILHA.auditorias.length} auditorias da planilha original.
          </Nota>
        )}

        <div className="dados-status">
          {d.modo === 'supabase' ? <Cloud size={20} aria-hidden /> : <HardDrive size={20} aria-hidden />}
          <div>
            <strong>{d.modo === 'supabase' ? 'Banco compartilhado (Supabase)' : 'Modo local'}</strong>
            <span className="texto-muted pequeno">
              {d.modo === 'supabase'
                ? ` · projeto ${new URL(SUPABASE_URL).hostname} · sessão: ${email}`
                : ' · os dados ficam só neste navegador; exporte para Excel com frequência'}
            </span>
          </div>
          <span className="chip chip--azul" title="Onde os novos PDFs são guardados">
            PDFs: {d.destinoAnexos === 'r2' ? 'Cloudflare R2' : d.destinoAnexos === 'supabase' ? 'Supabase' : 'este navegador'}
          </span>
        </div>

        <div className="abas" role="tablist" aria-label="Seções">
          {(
            [
              ['planilhas', 'Planilhas', FileSpreadsheet],
              ['turmas', 'Turmas e checklists', Users],
              ['anexos', 'Anexos (PDF)', Paperclip],
              ['diario', 'Diário Oficial', Landmark],
              ['atos', 'Conferência de atos', ClipboardCheck],
              ['avancado', 'Avançado', RotateCcw],
            ] as const
          ).map(([id, rotulo, Icone]) => (
            <button key={id} type="button" role="tab" id={`aba-${id}`} aria-selected={aba === id} aria-controls={`painel-${id}`} className={'abas__aba' + (aba === id ? ' abas__aba--ativa' : '')} onClick={() => irPara(id)}>
              <Icone size={16} aria-hidden /> {rotulo}
              {id === 'anexos' && alertaEspaco && <span className="abas__alerta" aria-label="Atenção ao espaço" />}
            </button>
          ))}
        </div>

        {aba === 'planilhas' && (
          <div role="tabpanel" id="painel-planilhas" aria-labelledby="aba-planilhas" className="dados-painel">
            <section className="cartao">
              <div className="cartao__corpo dados-linha">
                <div>
                  <h2 className="titulo-bloco">Exportar planilha completa</h2>
                  <p className="texto-muted pequeno">
                    Gera um arquivo .xlsx com as abas Cadastro Unidades, Lista Mestra, Plano de Visita Técnica, Auditoria Documental, Auditoria por Turma, Plano de Ação e
                    Relatórios, com os mesmos cabeçalhos da planilha original. Serve também como cópia de segurança.
                  </p>
                </div>
                <button type="button" className="btn btn--primario" onClick={exportarTudo}>
                  <Download size={16} aria-hidden /> Exportar Excel
                </button>
              </div>
            </section>
            <ImportarPlanilha />
          </div>
        )}

        {aba === 'turmas' && (
          <div role="tabpanel" id="painel-turmas" aria-labelledby="aba-turmas" className="dados-painel">
            <PanoramaTurmas />
          </div>
        )}

        {aba === 'anexos' && (
          <div role="tabpanel" id="painel-anexos" aria-labelledby="aba-anexos" className="dados-painel">
            {d.anexosErro ? (
              <Nota tipo="alerta">{d.anexosErro}</Nota>
            ) : (
              <>
                {noR2SemConfig && (
                  <Nota tipo="alerta">
                    Há PDFs guardados no <strong>Cloudflare R2</strong>, mas este endereço do site não está ligado a ele (falta a variável <code>VITE_ANEXOS_URL</code>): aqui eles não abrem
                    e novos PDFs seriam gravados no Supabase. Use o site configurado para o R2 ou cadastre a variável e publique de novo.
                  </Nota>
                )}
                {alertaEspaco === 'bloqueado' && (
                  <Nota tipo="alerta">Limite de segurança atingido: novos anexos estão bloqueados (os idênticos a arquivos já guardados ainda são aceitos). Exclua anexos desnecessários ou amplie o armazenamento.</Nota>
                )}
                {alertaEspaco === 'atencao' && (
                  <Nota tipo="alerta">O armazenamento está acima de 80%. Os envios serão bloqueados em {Math.round(MARGEM_BLOQUEIO * 100)}% para não gerar cobrança.</Nota>
                )}

                <div className="metricas">
                  <div>
                    <span>Anexos</span>
                    <strong>{espaco.anexos}</strong>
                  </div>
                  <div>
                    <span>Arquivos distintos</span>
                    <strong>{espaco.arquivos}</strong>
                  </div>
                  <div>
                    <span>Espaço usado</span>
                    <strong>{formatarTamanho(espaco.bytesUsados)}</strong>
                  </div>
                  <div>
                    <span>Economizado (idênticos)</span>
                    <strong>{formatarTamanho(espaco.bytesEconomizados)}</strong>
                  </div>
                </div>

                <section className="cartao">
                  <div className="cartao__cab">
                    <h2 className="titulo-bloco">Espaço de armazenamento</h2>
                    <HardDrive size={22} aria-hidden style={{ color: 'var(--verde-texto)' }} />
                  </div>
                  <div className="cartao__corpo" style={{ display: 'grid', gap: 16 }}>
                    <Barra f={usado} rotulo="PDFs anexados" detalhe={`${formatarTamanho(espaco.bytesUsados)} de ${formatarTamanho(limite)}. Mede só os PDFs, não o banco de dados.`} />
                    <p className="texto-muted pequeno" style={{ margin: 0 }}>
                      O limite vem de <code>VITE_LIMITE_ARMAZENAMENTO_GB</code>. Novos envios são recusados a partir de {Math.round(MARGEM_BLOQUEIO * 100)}% dele.
                    </p>
                  </div>
                </section>

                {d.destinoAnexos === 'r2' && (
                  <section className="cartao">
                    <div className="cartao__cab">
                      <h2 className="titulo-bloco">Cloudflare R2: operações neste mês</h2>
                      <Cloud size={22} aria-hidden style={{ color: 'var(--verde-texto)' }} />
                    </div>
                    <div className="cartao__corpo" style={{ display: 'grid', gap: 16 }}>
                      {([['A', 'Gravações', LIMITE_A], ['B', 'Leituras', LIMITE_B]] as const).map(([k, rotulo, lim]) => {
                        const v = uso ? uso[k] : 0;
                        return <Barra key={k} f={Math.min(1, v / lim)} rotulo={rotulo} detalhe={`${v.toLocaleString('pt-BR')} de ${lim.toLocaleString('pt-BR')} permitidos no mês`} />;
                      })}
                      <p className="texto-muted pequeno" style={{ margin: 0 }}>
                        O servidor recusa novas gravações e leituras ao atingir esses limites (zeram todo mês), para não gerar cobrança.
                      </p>
                    </div>
                  </section>
                )}

                {pendentesR2 > 0 && (
                  <section className="cartao">
                    <div className="cartao__corpo dados-linha">
                      <div>
                        <h2 className="titulo-bloco">Mover anexos para o Cloudflare R2</h2>
                        <p className="texto-muted pequeno">{pendentesR2} arquivo(s) ainda estão no Supabase. Cada um é copiado, conferido e só então apagado de lá.</p>
                      </div>
                      <button type="button" className="btn btn--primario" disabled={processando} onClick={() => void migrar()}>
                        Mover anexos
                      </button>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {aba === 'diario' && (
          <div role="tabpanel" id="painel-diario" aria-labelledby="aba-diario" className="dados-painel">
            <VarreduraDiario />
          </div>
        )}

        {aba === 'atos' && (
          <div role="tabpanel" id="painel-atos" aria-labelledby="aba-atos" className="dados-painel">
            <ConferenciaAtos />
          </div>
        )}

        {aba === 'avancado' && (
          <div role="tabpanel" id="painel-avancado" aria-labelledby="aba-avancado" className="dados-painel">
            <section className="cartao cartao--perigo">
              <div className="cartao__corpo dados-linha">
                <div>
                  <h2 className="titulo-bloco">{vazio ? 'Carregar dados da planilha' : 'Restaurar dados originais'}</h2>
                  <p className="texto-muted pequeno">
                    Recarrega o conteúdo original de <em>{PLANILHA.fonte}</em>: {PLANILHA.unidades.length} unidades e {PLANILHA.auditorias.length} auditorias.
                    {!vazio && <> <strong>Avaliações e ações registradas são apagadas.</strong> Exporte o Excel antes.</>}
                  </p>
                </div>
                <button type="button" className={vazio ? 'btn btn--verde' : 'btn btn--perigo'} disabled={processando} onClick={restaurar}>
                  <RotateCcw size={16} aria-hidden /> {vazio ? 'Carregar dados da planilha' : 'Restaurar dados originais'}
                </button>
              </div>
            </section>
          </div>
        )}
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
