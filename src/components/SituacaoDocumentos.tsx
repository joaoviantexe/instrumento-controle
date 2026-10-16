import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, ClipboardCheck, ShieldAlert } from 'lucide-react';
import { SECOES, SECOES_CURTAS } from '../data/planilha';
import { avaliado, linhasDaAuditoria, type Linha } from '../lib/calc';
import { ROTULO_VERIFICACAO, VERIFICACAO_FEITA, VERIFICACAO_PENDENTE, auditoriaDeReferencia, divergeDaDeclaracao } from '../lib/checklist';
import { formatarData } from '../lib/format';
import { useDados } from '../lib/store';
import { chaveAvaliacao } from '../lib/types';
import { Etiqueta, Medidor, Vazio } from './ui';

type Filtro = 'todos' | 'verificar' | 'nc' | 'pendentes';

/** Quem respondeu pela situação do item. */
function verificacao(l: Linha): { rotulo: string; classe: string } {
  if (l.verificacao === VERIFICACAO_PENDENTE) return { rotulo: ROTULO_VERIFICACAO[VERIFICACAO_PENDENTE], classe: 'chip--parcial' };
  if (divergeDaDeclaracao(l)) return { rotulo: 'Diverge da secretaria', classe: 'chip--nc' };
  if (l.verificacao === VERIFICACAO_FEITA) return { rotulo: ROTULO_VERIFICACAO[VERIFICACAO_FEITA], classe: 'chip--conforme' };
  if (avaliado(l.situacao)) return { rotulo: 'Avaliado pela CDE', classe: 'chip--azul' };
  return { rotulo: '—', classe: 'chip--vazio' };
}

/**
 * Situação de todos os documentos da auditoria da unidade (a mais recente iniciada, ou a escolhida): o que está avaliado,
 * conforme, o que a secretaria declarou e o que ainda requer verificação da CDE.
 */
export function SituacaoDocumentos({ unidadeId }: { unidadeId: string }) {
  const d = useDados();
  const auditorias = useMemo(
    () => d.auditorias.filter((a) => a.unidade_id === unidadeId).sort((a, b) => Number(b.iniciada) - Number(a.iniciada) || b.id.localeCompare(a.id)),
    [d.auditorias, unidadeId],
  );
  const [escolhida, setEscolhida] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const aud = auditorias.find((a) => a.id === escolhida) ?? auditoriaDeReferencia(auditorias, unidadeId);
  const linhas = useMemo(() => (aud ? linhasDaAuditoria(aud.id, d.mapaAvaliacoes) : []), [aud, d.mapaAvaliacoes]);
  const anexosPorItem = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of d.anexos) if (a.entidade === 'avaliacao') m.set(a.entidade_id, (m.get(a.entidade_id) ?? 0) + 1);
    return m;
  }, [d.anexos]);

  if (!aud) {
    return (
      <Vazio texto="Esta unidade ainda não tem auditoria. Envie a checklist da secretaria escolar (abaixo) ou registre uma nova auditoria." />
    );
  }

  const resumo = d.resumos.get(aud.id);
  const conta = (f: (l: Linha) => boolean) => linhas.filter(f).length;
  const n = {
    avaliados: conta((l) => avaliado(l.situacao)),
    conformes: conta((l) => l.situacao === 'Conforme'),
    parciais: conta((l) => l.situacao === 'Parcialmente conforme'),
    nc: conta((l) => l.situacao === 'Não conforme'),
    na: conta((l) => l.situacao === 'Não se aplica'),
    pendentes: conta((l) => !avaliado(l.situacao)),
    verificar: conta((l) => l.verificacao === VERIFICACAO_PENDENTE || divergeDaDeclaracao(l)),
    verificados: conta((l) => l.verificacao === VERIFICACAO_FEITA),
  };
  const filtros: Record<Filtro, [string, number]> = {
    todos: ['Todos', linhas.length],
    verificar: ['Requer verificação da CDE', n.verificar],
    nc: ['Não conforme / parcial', n.nc + n.parciais],
    pendentes: ['Não avaliado', n.pendentes],
  };
  const visivel = (l: Linha) =>
    filtro === 'verificar'
      ? l.verificacao === VERIFICACAO_PENDENTE || divergeDaDeclaracao(l)
      : filtro === 'nc'
        ? l.situacao === 'Não conforme' || l.situacao === 'Parcialmente conforme'
        : filtro === 'pendentes'
          ? !avaliado(l.situacao)
          : true;

  return (
    <div className="situacao-docs">
      <div className="situacao-docs__topo">
        {auditorias.length > 1 ? (
          <label className="situacao-docs__aud">
            <span>Auditoria</span>
            <select value={aud.id} onChange={(e) => setEscolhida(e.target.value)}>
              {auditorias.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id} · {a.tipo || 'sem tipo'} · {a.situacao || 'sem situação'}
                  {a.data_realizada || a.data_planejada ? ` · ${formatarData(a.data_realizada || a.data_planejada)}` : ''}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="pequeno texto-muted">
            {aud.id} · {aud.tipo || 'sem tipo'} · <Etiqueta valor={aud.situacao} />
          </span>
        )}
        <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
          <Medidor valor={resumo?.indice ?? null} />
          <Link to={`/auditoria-documental/${aud.id}`} className="btn btn--contorno btn--pequeno">
            <ClipboardCheck size={14} aria-hidden /> Abrir a Auditoria Documental
          </Link>
        </span>
      </div>

      <div className="metricas metricas--compactas">
        <div>
          <span>Avaliados</span>
          <strong>
            {n.avaliados}/{linhas.length}
          </strong>
        </div>
        <div>
          <span>Conformes</span>
          <strong className="texto-conforme">{n.conformes}</strong>
        </div>
        <div>
          <span>Parcialmente conformes</span>
          <strong>{n.parciais}</strong>
        </div>
        <div>
          <span>Não conformes</span>
          <strong className="texto-nc">{n.nc}</strong>
        </div>
        <div>
          <span>Não se aplica</span>
          <strong>{n.na}</strong>
        </div>
        <div>
          <span>Requer verificação da CDE</span>
          <strong className={n.verificar ? 'texto-alerta' : ''}>{n.verificar}</strong>
        </div>
      </div>

      {n.verificar > 0 && (
        <p className="situacao-docs__aviso">
          <ShieldAlert size={16} aria-hidden /> {n.verificar} documento(s) foram declarados pela secretaria escolar sem comprovação (ou divergem da
          avaliação da CDE). Confira os documentos na visita e confirme ou corrija cada um na Auditoria Documental.
        </p>
      )}
      {n.verificados > 0 && (
        <p className="pequeno texto-muted" style={{ margin: 0 }}>
          <BadgeCheck size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> {n.verificados} declaração(ões) da secretaria já verificada(s) pela CDE.
        </p>
      )}

      <div className="pilulas" role="group" aria-label="Filtrar documentos">
        {(Object.keys(filtros) as Filtro[]).map((k) => (
          <button type="button" key={k} className="pilula" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>
            {filtros[k][0]} <b>{filtros[k][1]}</b>
          </button>
        ))}
      </div>

      <div className="tabela-wrap">
        <table className="tabela tabela--compacta situacao-docs__tabela">
          <thead>
            <tr>
              <th>Documento</th>
              <th>Situação</th>
              <th>Verificação</th>
              <th>Secretaria declarou</th>
              <th className="num">PDFs</th>
            </tr>
          </thead>
          {SECOES.map((secao) => {
            const ls = linhas.filter((l) => l.def.secao === secao && visivel(l));
            if (!ls.length) return null;
            return (
              <tbody key={secao}>
                <tr className="secao-linha">
                  <td colSpan={5}>
                    {secao.split('.')[0]}. {SECOES_CURTAS[secao]}
                  </td>
                </tr>
                {ls.map((l) => {
                  const v = verificacao(l);
                  const pdfs = anexosPorItem.get(chaveAvaliacao(l.auditoria_id, l.item)) ?? 0;
                  return (
                    <tr key={l.item}>
                      <td>
                        <Link to={`/auditoria-documental/${aud.id}#item-${l.item}`} className="situacao-docs__item">
                          <span className="item-aud__codigo">{l.item}</span> {l.def.item}
                        </Link>
                      </td>
                      <td>
                        <Etiqueta valor={l.situacao} />
                      </td>
                      <td>
                        <span className={'chip ' + v.classe}>{v.rotulo}</span>
                      </td>
                      <td title={l.declaracao || undefined}>{l.declarado ? <Etiqueta valor={l.declarado} /> : <span className="texto-muted">—</span>}</td>
                      <td className="num">{pdfs || <span className="texto-muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>
      {!linhas.some(visivel) && <p className="tabela-vazia">Nenhum documento neste filtro.</p>}
    </div>
  );
}
