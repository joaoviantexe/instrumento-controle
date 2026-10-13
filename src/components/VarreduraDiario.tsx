import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Pause, Play, RotateCcw, ScanSearch } from 'lucide-react';
import { CampoTexto, Dialogo, Nota } from './ui';
import { avisar } from '../lib/avisos';
import { DIARIO_URL } from '../lib/diario';
import { formatarData } from '../lib/format';
import { carregarPdfjs, encerrarTrabalhadores, extrairPaginas, trabalhadorPdf } from '../lib/pdfTexto';
import { edicoesLidas, limparVarredura, listaGuardada, salvarEdicao, salvarLista, type EdicaoLida } from '../lib/varreduraArmazem';
import { atosDaEdicao, lerListaEdicoes, semTexto, type Edicao } from '../lib/varreduraDiario';

/** Duas edições ao mesmo tempo, com uma pausa entre os pedidos, para não sobrecarregar o site da Prefeitura. */
const SIMULTANEAS = 2;
const PAUSA_MS = 400;
/** Falhas seguidas que fazem a varredura parar sozinha (site fora do ar, internet caiu). */
const MAX_FALHAS_SEGUIDAS = 8;

/** Só uma varredura por vez, mesmo que a aba seja fechada e reaberta enquanto as últimas edições terminam. */
let emExecucao = false;

/**
 * Pausa entre os pedidos. Com a aba em segundo plano o navegador atrasa os temporizadores (um por minuto), o que levaria dias:
 * nesse caso o ritmo fica por conta do próprio download.
 */
const esperar = (ms: number) => (document.hidden ? Promise.resolve() : new Promise((ok) => setTimeout(ok, ms)));

/** Mensagem em português para os erros de rede do navegador ("Failed to fetch"). */
const erroLegivel = (err: unknown) => (err instanceof TypeError ? 'sem conexão com o servidor' : (err as Error).message);
const terminada = (e?: EdicaoLida) => e?.situacao === 'lida' || e?.situacao === 'sem-texto';

function duracao(ms: number) {
  const min = Math.round(ms / 60000);
  return min < 1 ? 'menos de 1 min' : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

async function carregarLista(aoProgredir: (n: number, total: number) => void): Promise<Edicao[]> {
  const todas = new Map<number, Edicao>();
  for (let start = 0; ; start += 100) {
    const r = await fetch(`${DIARIO_URL}/diario/edicoes?start=${start}&rows=100`, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`a lista de edições não carregou (erro ${r.status})`);
    const { total, edicoes } = lerListaEdicoes(await r.json());
    edicoes.forEach((e) => todas.set(e.id, e));
    aoProgredir(todas.size, total);
    if (edicoes.length === 0 || todas.size >= total) break;
    await esperar(150);
  }
  return [...todas.values()].sort((a, b) => b.id - a.id);
}

async function lerEdicao(e: Edicao, vaga: number): Promise<EdicaoLida> {
  // no-store: milhares de PDFs não precisam ficar no cache do navegador.
  const r = await fetch(`${DIARIO_URL}/diario/${e.id}.pdf`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`erro ${r.status} ao baixar`);
  const dados = await r.arrayBuffer();
  if (new TextDecoder().decode(dados.slice(0, 5)) !== '%PDF-') throw new Error('o arquivo recebido não é um PDF');
  const pdfjs = await carregarPdfjs();
  const paginas = await extrairPaginas(pdfjs, dados, trabalhadorPdf(pdfjs, vaga));
  if (semTexto(paginas)) return { ...e, situacao: 'sem-texto', paginas: paginas.length, atos: [] };
  return { ...e, situacao: 'lida', paginas: paginas.length, atos: atosDaEdicao(paginas) };
}

/**
 * Varre as edições do Diário Oficial pelo Worker e separa os atos institucionais sobre escolas. Roda no navegador de quem
 * está no Brasil (o site da Prefeitura recusa acessos de fora) e guarda o progresso neste navegador, então pode ser pausada
 * e retomada. O resultado é um arquivo para a associação com as unidades.
 */
export function VarreduraDiario() {
  const [lista, setLista] = useState<Edicao[] | null>(null);
  const lidas = useRef(new Map<number, EdicaoLida>());
  const [versao, setVersao] = useState(0);
  const [rodando, setRodando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [limpando, setLimpando] = useState(false);
  const [ritmo, setRitmo] = useState<{ inicio: number; feitas: number; total: number } | null>(null);
  const [pausando, setPausando] = useState(false);
  const [semPersistencia, setSemPersistencia] = useState(false);
  const parar = useRef(false);

  // Ao sair da aba ou da página a varredura pausa: sem isso ela continuaria em segundo plano e uma segunda poderia começar.
  useEffect(() => () => void (parar.current = true), []);

  useEffect(() => {
    void (async () => {
      try {
        const [l, guardadas] = await Promise.all([listaGuardada(), edicoesLidas()]);
        if (l) setLista(l);
        guardadas.forEach((e) => lidas.current.set(e.id, e));
        setVersao((v) => v + 1);
      } catch {
        setMensagem('Este navegador não permite guardar o progresso (modo anônimo?). A varredura funciona, mas recomeça se a aba for fechada.');
      }
    })();
  }, []);

  const erroFaixa = (() => {
    const invalido = (v: string) => v !== '' && (!Number.isInteger(Number(v)) || Number(v) < 1);
    if (invalido(de) || invalido(ate)) return 'Informe um número inteiro positivo.';
    if (de && ate && Number(de) > Number(ate)) return 'A edição inicial é maior que a final.';
    return '';
  })();

  const faixa = (e: Edicao) => (!de || e.id >= Number(de)) && (!ate || e.id <= Number(ate));

  const resumo = useMemo(() => {
    const todas = [...lidas.current.values()];
    const alvo = (lista ?? []).filter(faixa);
    return {
      alvo: alvo.length,
      feitas: alvo.filter((e) => terminada(lidas.current.get(e.id))).length,
      lidas: todas.filter((e) => e.situacao === 'lida').length,
      semTexto: todas.filter((e) => e.situacao === 'sem-texto').length,
      erros: todas.filter((e) => e.situacao === 'erro').length,
      atos: todas.reduce((s, e) => s + e.atos.length, 0),
      recentes: todas
        .filter((e) => e.atos.length)
        .sort((a, b) => b.id - a.id)
        .slice(0, 6)
        .flatMap((e) => e.atos.slice(0, 2).map((a) => ({ e, a }))),
    };
  }, [versao, lista, de, ate]); // eslint-disable-line react-hooks/exhaustive-deps

  async function iniciar() {
    if (emExecucao) {
      setMensagem('A varredura anterior ainda está terminando as últimas edições. Aguarde alguns segundos e tente de novo.');
      return;
    }
    emExecucao = true;
    parar.current = false;
    setRodando(true);
    setPausando(false);
    setMensagem('');
    const bloqueio = await (navigator.wakeLock?.request('screen') ?? Promise.resolve(null)).catch(() => null);
    let erros = 0;
    try {
      // A lista é recarregada a cada início para incluir as edições publicadas desde a última vez.
      let l = lista;
      try {
        setMensagem('Carregando a lista de edições do painel…');
        l = await carregarLista((n, total) => setMensagem(`Carregando a lista de edições do painel… ${n} de ${total}`));
        setLista(l);
        await salvarLista(l).catch(() => undefined);
      } catch (err) {
        if (!l) throw err;
      }
      // Edições nunca tentadas primeiro; as que deram erro vão para o fim (uma edição que sempre falha não trava as demais).
      const pendentes = l.filter((e) => faixa(e) && !terminada(lidas.current.get(e.id)));
      const fila = [...pendentes.filter((e) => !lidas.current.has(e.id)), ...pendentes.filter((e) => lidas.current.has(e.id))];
      if (fila.length === 0) {
        setMensagem(
          l.some(faixa) ? 'Todas as edições desta faixa já foram lidas. Baixe o resultado.' : 'Nenhuma edição do painel está nesta faixa.',
        );
        return;
      }
      setMensagem(`Lendo ${fila.length} edições…`);
      setRitmo({ inicio: performance.now(), feitas: 0, total: fila.length });
      let proxima = 0;
      let falhasSeguidas = 0;
      const trabalhar = async (vaga: number) => {
        while (!parar.current && proxima < fila.length) {
          const e = fila[proxima++];
          let r: EdicaoLida;
          try {
            r = await lerEdicao(e, vaga);
            falhasSeguidas = 0;
          } catch (err) {
            r = { ...e, situacao: 'erro', atos: [], erro: erroLegivel(err) };
            falhasSeguidas++;
            erros++;
          }
          lidas.current.set(e.id, r);
          await salvarEdicao(r).catch(() => setSemPersistencia(true));
          setVersao((v) => v + 1);
          setRitmo((x) => (x ? { ...x, feitas: x.feitas + 1 } : x));
          if (falhasSeguidas >= MAX_FALHAS_SEGUIDAS && !parar.current) {
            parar.current = true;
            setMensagem(`Parou após ${MAX_FALHAS_SEGUIDAS} falhas seguidas (último erro: ${r.erro}). Confira a internet e clique em Continuar.`);
          }
          await esperar(PAUSA_MS);
        }
      };
      await Promise.all(Array.from({ length: SIMULTANEAS }, (_, vaga) => trabalhar(vaga)));
      if (!parar.current) {
        setMensagem(
          erros > 0
            ? `Terminou, mas ${erros} edições deram erro. Clique em Continuar para tentar de novo ou baixe o resultado assim mesmo.`
            : 'Varredura concluída. Baixe o resultado e envie o arquivo.',
        );
      } else if (falhasSeguidas < MAX_FALHAS_SEGUIDAS) {
        setMensagem('Varredura pausada. Clique em Continuar quando quiser.');
      }
    } catch (err) {
      setMensagem('Não foi possível continuar: ' + erroLegivel(err));
    } finally {
      void bloqueio?.release().catch(() => undefined);
      encerrarTrabalhadores();
      emExecucao = false;
      setRodando(false);
      setPausando(false);
      setRitmo(null);
    }
  }

  function pausar() {
    parar.current = true;
    setPausando(true);
    setMensagem('Pausando… aguardando as edições em andamento terminarem.');
  }

  function baixar() {
    const todas = [...lidas.current.values()].sort((a, b) => b.id - a.id);
    const saida = {
      fonte: 'Diário Oficial do Município de Belém (painel sistemas.belem.pa.gov.br/diario), via Worker do Instrumento de Controle',
      gerado_em: new Date().toISOString(),
      edicoes_no_painel: lista?.length ?? null,
      edicoes_lidas: todas.filter((e) => e.situacao === 'lida').length,
      sem_texto: todas.filter((e) => e.situacao === 'sem-texto').map((e) => ({ edicao: e.id, data: e.data, paginas: e.paginas })),
      erros: todas.filter((e) => e.situacao === 'erro').map((e) => ({ edicao: e.id, data: e.data, erro: e.erro })),
      atos: todas.flatMap((e) => e.atos.map((a) => ({ edicao: e.id, data_edicao: e.data, ...a }))),
    };
    const blob = new Blob([JSON.stringify(saida)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `varredura-diario-oficial-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    avisar(`Arquivo gerado com ${saida.atos.length} atos de ${saida.edicoes_lidas} edições.`);
  }

  async function recomecar() {
    await limparVarredura().catch(() => undefined);
    lidas.current.clear();
    setLista(null);
    setVersao((v) => v + 1);
    setMensagem('Progresso apagado.');
  }

  if (!DIARIO_URL) {
    return (
      <Nota tipo="alerta">
        A varredura usa o Worker da Cloudflare para buscar as edições. Cadastre a variável <code>VITE_ANEXOS_URL</code> (ou <code>VITE_DIARIO_URL</code>) e publique o site de novo.
      </Nota>
    );
  }

  const f = resumo.alvo ? resumo.feitas / resumo.alvo : 0;
  const restante = ritmo && ritmo.feitas >= 4 ? ((performance.now() - ritmo.inicio) / ritmo.feitas) * Math.max(0, ritmo.total - ritmo.feitas) : null;

  return (
    <>
      <section className="cartao">
        <div className="cartao__cab">
          <h2 className="titulo-bloco">Varredura do Diário Oficial</h2>
          <ScanSearch size={22} aria-hidden style={{ color: 'var(--verde-texto)' }} />
        </div>
        <div className="cartao__corpo" style={{ display: 'grid', gap: 16 }}>
          <p className="texto-muted pequeno" style={{ margin: 0 }}>
            Lê todas as edições do Diário Oficial do Município e separa os atos sobre escolas: criação, instituição, extinção, mudança de nome,
            autorização de funcionamento e outros. O resultado é um arquivo para a associação automática com as unidades do cadastro. Deixe esta
            aba aberta (de preferência visível): são cerca de 5 mil edições (alguns GB de download), o que leva de 1 a 3 horas. Pode pausar e
            continuar depois, neste mesmo navegador.
          </p>

          <div className="metricas">
            <div>
              <span>Edições no painel</span>
              <strong>{lista ? lista.length.toLocaleString('pt-BR') : '—'}</strong>
            </div>
            <div>
              <span>Lidas</span>
              <strong>{resumo.lidas.toLocaleString('pt-BR')}</strong>
            </div>
            <div>
              <span>Sem texto (digitalizadas)</span>
              <strong>{resumo.semTexto.toLocaleString('pt-BR')}</strong>
            </div>
            <div>
              <span>Com erro</span>
              <strong>{resumo.erros.toLocaleString('pt-BR')}</strong>
            </div>
            <div>
              <span>Atos encontrados</span>
              <strong>{resumo.atos.toLocaleString('pt-BR')}</strong>
            </div>
          </div>

          {lista && (
            <div className="medicao">
              <div className="medicao__topo">
                <span>Progresso{de || ate ? ' (faixa escolhida)' : ''}</span>
                <span>
                  <strong>{resumo.feitas.toLocaleString('pt-BR')}</strong> de {resumo.alvo.toLocaleString('pt-BR')}
                  {resumo.erros > 0 && <> · {resumo.erros.toLocaleString('pt-BR')} com erro</>}
                  {restante !== null && <> · faltam cerca de {duracao(restante)}</>}
                </span>
              </div>
              <div className="armazenamento__trilho" role="progressbar"
                aria-label="Progresso da varredura"
                aria-valuemin={0}
                aria-valuemax={resumo.alvo}
                aria-valuenow={resumo.feitas}
                aria-valuetext={`${resumo.feitas} de ${resumo.alvo} edições`}
              >
                <div className="armazenamento__barra" style={{ width: `${Math.max(f * 100, f > 0 ? 1 : 0)}%` }} />
              </div>
            </div>
          )}

          <div className="varredura__faixa">
            <CampoTexto rotulo="Da edição nº" tipo="number" valor={de} aoMudar={setDe} desabilitado={rodando} placeholder="primeira" erro={erroFaixa && de ? erroFaixa : undefined} />
            <CampoTexto rotulo="Até a edição nº" tipo="number" valor={ate} aoMudar={setAte} desabilitado={rodando} placeholder="última" erro={erroFaixa && ate ? erroFaixa : undefined} />
            <small className="texto-muted">Opcional: deixe em branco para ler todas.</small>
          </div>

          <div className="varredura__botoes">
            {rodando ? (
              <button type="button" className="btn btn--neutro" disabled={pausando} onClick={pausar}>
                <Pause size={16} aria-hidden /> {pausando ? 'Pausando…' : 'Pausar'}
              </button>
            ) : (
              <button type="button" className="btn btn--primario" disabled={Boolean(erroFaixa)} onClick={() => void iniciar()}>
                <Play size={16} aria-hidden /> {lidas.current.size > 0 ? 'Continuar' : 'Iniciar varredura'}
              </button>
            )}
            <button type="button" className="btn btn--verde" disabled={resumo.atos === 0} onClick={baixar}>
              <Download size={16} aria-hidden /> Baixar resultado
            </button>
            <button type="button" className="btn btn--neutro" disabled={rodando || lidas.current.size === 0} onClick={() => setLimpando(true)}>
              <RotateCcw size={16} aria-hidden /> Recomeçar do zero
            </button>
          </div>
          {semPersistencia && (
            <Nota tipo="alerta">
              Não foi possível guardar o progresso neste navegador (espaço cheio ou modo anônimo). A varredura continua, mas se a aba for fechada ela recomeça:
              baixe o resultado de tempos em tempos.
            </Nota>
          )}
          {mensagem && (
            <p className="pequeno" role="status" style={{ margin: 0 }}>
              {mensagem}
            </p>
          )}
        </div>
      </section>

      {resumo.recentes.length > 0 && (
        <section className="cartao">
          <div className="cartao__cab">
            <h2 className="titulo-bloco">Últimos atos encontrados</h2>
          </div>
          <ul className="cartao__corpo lista-simples">
            {resumo.recentes.map(({ e, a }) => (
              <li key={`${e.id}-${a.pagina}-${a.titulo}`}>
                <strong>{a.titulo}</strong>
                <span className="texto-muted pequeno">
                  {' '}
                  · DOM nº {e.id.toLocaleString('pt-BR')}, de {formatarData(e.data)}, p. {a.pagina}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {limpando && (
        <Dialogo titulo="Recomeçar do zero" confirmar="Apagar o progresso" perigo aoFechar={() => setLimpando(false)} aoConfirmar={() => void recomecar()}>
          <p>Apaga deste navegador o que já foi lido ({resumo.atos} atos de {lidas.current.size} edições). Baixe o resultado antes, se ainda não baixou.</p>
        </Dialogo>
      )}
    </>
  );
}
