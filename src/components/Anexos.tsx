import { useRef, useState, type DragEvent } from 'react';
import { FileText, Paperclip, Trash2, Upload } from 'lucide-react';
import { CATEGORIAS, CATEGORIA_ATO, armazenamentoCheio, LIMITE_BYTES, formatarTamanho, validarPdf } from '../lib/anexos';
import { avisar } from '../lib/avisos';
import { formatarData } from '../lib/format';
import { useDados } from '../lib/store';
import type { Anexo, EntidadeAnexo } from '../lib/types';
import { CampoSelect, Dialogo, Nota } from './ui';

/** Lista e envio de PDFs de um registro (unidade, item de auditoria ou ação). */
export function Anexos({ entidade, entidadeId }: { entidade: EntidadeAnexo; entidadeId: string }) {
  const d = useDados();
  const categorias = CATEGORIAS[entidade];
  const [categoria, setCategoria] = useState(categorias.includes(CATEGORIA_ATO) ? CATEGORIA_ATO : categorias[0]);
  const [enviando, setEnviando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [excluindo, setExcluindo] = useState<Anexo | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const lista = d.anexos.filter((a) => a.entidade === entidade && a.entidade_id === entidadeId);

  const cheio = armazenamentoCheio(d.anexos);

  if (d.anexosErro) return <Nota tipo="alerta">{d.anexosErro}</Nota>;

  async function enviar(arquivos: FileList | File[]) {
    setEnviando(true);
    try {
      for (const arquivo of Array.from(arquivos)) {
        const erro = await validarPdf(arquivo);
        if (erro) {
          avisar(erro, 'erro');
          continue;
        }
        try {
          await d.enviarAnexo(arquivo, { entidade, entidade_id: entidadeId, categoria });
          avisar(`"${arquivo.name}" anexado.`);
        } catch (e) {
          avisar('Não foi possível anexar: ' + (e as Error).message, 'erro');
        }
      }
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = '';
    }
  }

  async function abrir(a: Anexo) {
    // A janela é aberta antes da espera para não ser bloqueada pelo navegador.
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

  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setArrastando(false);
    if (e.dataTransfer.files.length) void enviar(e.dataTransfer.files);
  };

  return (
    <div className="anexos">
      {lista.length > 0 && (
        <ul className="anexos__lista">
          {lista.map((a) => (
            <li key={a.id}>
              <FileText size={20} aria-hidden />
              <div className="anexos__info">
                <button type="button" className="anexos__nome" onClick={() => void abrir(a)} title="Abrir o PDF em outra aba">
                  {a.nome}
                </button>
                <small>
                  {a.categoria} · {formatarTamanho(a.tamanho)} · {formatarData(a.criado_em.slice(0, 10))}
                  {a.criado_por && ` · ${a.criado_por}`}
                </small>
              </div>
              <button
                type="button"
                className="btn btn--perigo btn--icone"
                onClick={() => setExcluindo(a)}
                title="Excluir anexo"
                aria-label={`Excluir ${a.nome}`}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {cheio && (
        <Nota tipo="alerta">
          Armazenamento no limite de segurança: novos arquivos serão recusados (exceto os idênticos a um já guardado). Veja <strong>Dados e planilhas</strong>.
        </Nota>
      )}
      <div
        className={'anexos__drop' + (arrastando ? ' anexos__drop--ativo' : '')}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={soltar}
      >
        <Upload size={20} aria-hidden />
        <span>Arraste um PDF para cá ou</span>
        {categorias.length > 1 && (
          <CampoSelect rotulo="Tipo de documento" valor={categoria} aoMudar={setCategoria} opcoes={categorias} vazio={false} classe="anexos__tipo" />
        )}
        <button type="button" className="btn btn--contorno btn--pequeno" disabled={enviando} onClick={() => entrada.current?.click()}>
          <Paperclip size={14} aria-hidden /> {enviando ? 'Enviando…' : 'Anexar PDF'}
        </button>
        <input
          ref={entrada}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => e.target.files && void enviar(e.target.files)}
        />
        <small>PDF de até {formatarTamanho(LIMITE_BYTES)}</small>
      </div>

      {excluindo && (
        <Dialogo
          titulo="Excluir anexo"
          confirmar="Excluir"
          perigo
          aoFechar={() => setExcluindo(null)}
          aoConfirmar={async () => {
            try {
              await d.excluirAnexo(excluindo);
              avisar('Anexo excluído.');
            } catch (e) {
              avisar('Não foi possível excluir: ' + (e as Error).message, 'erro');
            }
          }}
        >
          <p>
            Excluir <strong>{excluindo.nome}</strong>? O arquivo será apagado e não poderá ser recuperado.
          </p>
        </Dialogo>
      )}
    </div>
  );
}

/** Contagem de anexos de um registro (para mostrar um selo "📎 2"). */
export function useQuantidadeAnexos(entidade: EntidadeAnexo, entidadeId: string): number {
  const { anexos } = useDados();
  return anexos.filter((a) => a.entidade === entidade && a.entidade_id === entidadeId).length;
}
