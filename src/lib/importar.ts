/**
 * Importação de planilha Excel: lê o arquivo (original ou exportado pelo sistema), compara com os dados
 * atuais e monta a lista do que será criado e alterado. Nada é excluído.
 */
import {
  CABECALHOS_UNIDADE,
  LISTA_MESTRA,
  ROTULOS_ACAO as RA,
  ROTULOS_AUDITORIA_DOC as RD,
  ROTULOS_PLANO as RP,
  SITUACOES_ITEM,
} from '../data/planilha';
import { proximoId } from './calc';
import { lerData, normalizar } from './format';
import type { Acao, Auditoria, Avaliacao, SituacaoItem, Snapshot, Unidade } from './types';

type Linha = Record<string, string>;

export interface TabelaLida {
  /** Nome da aba usada no arquivo. */
  aba: string;
  /** Cabeçalhos esperados que existem na aba (colunas ausentes não alteram os dados). */
  presentes: Set<string>;
  linhas: Linha[];
}

export interface Planilha {
  unidades?: TabelaLida;
  auditorias?: TabelaLida;
  avaliacoes?: TabelaLida;
  acoes?: TabelaLida;
}

const chave = (s: string) => normalizar(s).replace(/\s+/g, ' ').replace(/[:.]+$/, '').trim();

// ---------------------------------------------------------------- leitura do arquivo

type Valor = unknown;

export function celulaParaTexto(v: Valor): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  const o = v as { richText?: { text: string }[]; result?: Valor; text?: Valor; error?: string };
  if (o.richText) return o.richText.map((p) => p.text).join('').trim();
  if (o.error) return '';
  if ('result' in o) return celulaParaTexto(o.result);
  if ('text' in o) return celulaParaTexto(o.text);
  return '';
}

interface FolhaMin {
  name: string;
  rowCount: number;
  getRow(n: number): { getCell(c: number): { value: Valor }; cellCount: number };
}

function lerAba(ws: FolhaMin, esperados: string[], minimo: number, sinonimos: Record<string, string> = {}): TabelaLida | null {
  const alvo = new Map([...esperados.map((e) => [chave(e), e] as const), ...Object.entries(sinonimos)]);
  const limite = Math.min(ws.rowCount, 15);
  for (let r = 1; r <= limite; r++) {
    const linha = ws.getRow(r);
    const colunas = new Map<number, string>();
    for (let c = 1; c <= Math.max(linha.cellCount, esperados.length + 5); c++) {
      const rotulo = alvo.get(chave(celulaParaTexto(linha.getCell(c).value)));
      if (rotulo && ![...colunas.values()].includes(rotulo)) colunas.set(c, rotulo);
    }
    if (colunas.size < minimo) continue;
    const linhas: Linha[] = [];
    for (let i = r + 1; i <= ws.rowCount; i++) {
      const l = ws.getRow(i);
      const reg: Linha = {};
      let algum = false;
      for (const [c, rotulo] of colunas) {
        const t = celulaParaTexto(l.getCell(c).value);
        reg[rotulo] = t;
        if (t) algum = true;
      }
      if (algum) linhas.push(reg);
    }
    return { aba: ws.name, presentes: new Set(colunas.values()), linhas };
  }
  return null;
}

/** Procura cada tabela pelo nome da aba e, se não achar, pelos cabeçalhos de todas as abas. */
export async function lerPlanilha(arquivo: File): Promise<Planilha> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await arquivo.arrayBuffer());
  const folhas = wb.worksheets as unknown as FolhaMin[];

  const procurar = (nomes: string[], esperados: string[], minimo: number, sinonimos: Record<string, string> = {}) => {
    const porNome = folhas.filter((f) => nomes.includes(chave(f.name)));
    for (const f of [...porNome, ...folhas.filter((x) => !porNome.includes(x))]) {
      const t = lerAba(f, esperados, minimo, sinonimos);
      if (t) return t;
    }
    return undefined;
  };

  return {
    unidades: procurar(['cadastro unidades'], Object.values(CABECALHOS_UNIDADE), 8, {
      'ato de criacao': CABECALHOS_UNIDADE.ato_criacao,
      'ato de autorizacao/credenciamento/reconhecimento': CABECALHOS_UNIDADE.ato_autorizacao,
    }),
    auditorias: procurar(['plano de visita tecnica', 'plano de auditoria'], [RP.id, RP.unidade, RP.tipo, RP.prioridade, RP.dataPlanejada, RP.dataRealizada, RP.equipe, RP.situacao, RP.observacoes], 6),
    avaliacoes: procurar(['auditoria documental'], [RD.id, RD.item, RD.situacao, RD.evidencia, RD.achado, RD.requerAcao, RD.prazo, RD.responsavel, RD.situacaoAcao], 5),
    acoes: procurar(['plano de acao'], [RA.id, RA.auditoria, RA.unidade, RA.item, RA.achado, RA.acao, RA.prioridade, RA.responsavel, RA.dataAbertura, RA.prazo, RA.situacao, RA.evidencia, RA.dataConclusao, RA.validacao], 8),
  };
}

// ---------------------------------------------------------------- comparação

export interface Alteracao<T> {
  antes: T;
  depois: T;
  /** Campos que mudaram, com rótulo legível. */
  campos: { rotulo: string; de: string; para: string }[];
}

export interface ResumoTabela<T> {
  encontrada: boolean;
  aba?: string;
  lidas: number;
  novos: T[];
  alterados: Alteracao<T>[];
  iguais: number;
}

export interface Plano {
  unidades: ResumoTabela<Unidade>;
  auditorias: ResumoTabela<Auditoria>;
  avaliacoes: ResumoTabela<Avaliacao>;
  acoes: ResumoTabela<Acao>;
  avisos: string[];
}

function vazia<T>(t?: TabelaLida): ResumoTabela<T> {
  return { encontrada: !!t, aba: t?.aba, lidas: t?.linhas.length ?? 0, novos: [], alterados: [], iguais: 0 };
}

function comparar<T extends object>(antes: T, depois: T, rotulos: Partial<Record<keyof T, string>>): Alteracao<T>['campos'] {
  const campos: Alteracao<T>['campos'] = [];
  for (const k of Object.keys(rotulos) as (keyof T)[]) {
    const a = String(antes[k] ?? '');
    const b = String(depois[k] ?? '');
    if (a !== b) campos.push({ rotulo: rotulos[k]!, de: a, para: b });
  }
  return campos;
}

const soDigitos = (s: string) => s.replace(/\D/g, '');
/** DD/MM/AAAA → AAAA-MM-DD (aceita MM/DD/AAAA quando o dia seria maior que 12); textos e anos inválidos ficam como vieram. */
function data(s: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return lerData(s);
  const [a, b, ano] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (ano < 1900 || ano > 2200) return s.trim();
  const [dia, mes] = b > 12 ? [b, a] : [a, b];
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Aplica só as colunas presentes no arquivo; as demais mantêm o valor atual. */
function mesclar<T extends object>(base: T, lido: Linha, mapa: Partial<Record<keyof T, string>>, presentes: Set<string>, conv: Partial<Record<keyof T, (v: string) => string>> = {}): T {
  const r = { ...base } as Record<string, unknown>;
  for (const [campo, rotulo] of Object.entries(mapa) as [keyof T & string, string][]) {
    if (!presentes.has(rotulo)) continue;
    const v = lido[rotulo] ?? '';
    r[campo] = (conv[campo] ?? ((x: string) => x))(v);
  }
  return r as T;
}

function idAuditoria(bruto: string): string {
  const m = /^AUD-?0*(\d+)$/i.exec(bruto.trim());
  return m ? `AUD-${m[1].padStart(3, '0')}` : bruto.trim();
}

export function planejarImportacao(p: Planilha, atual: Snapshot): Plano {
  const avisos: string[] = [];
  const plano: Plano = {
    unidades: vazia(p.unidades),
    auditorias: vazia(p.auditorias),
    avaliacoes: vazia(p.avaliacoes),
    acoes: vazia(p.acoes),
    avisos,
  };

  // ---- Unidades: pelo INEP (quando único) ou, na falta dele, pelo nome
  const unidades = [...atual.unidades];
  const porInep = new Map<string, Unidade>();
  const porNome = new Map<string, Unidade>();
  const indexarUnidade = (u: Unidade) => {
    const inep = soDigitos(u.inep);
    if (inep) porInep.set(inep, u);
    porNome.set(chave(u.nome), u);
  };
  // O INEP se repete entre a sede e seus anexos: só identifica a unidade quando é único.
  const contagemInep = new Map<string, number>();
  const contar = (inep: string) => inep && contagemInep.set(inep, (contagemInep.get(inep) ?? 0) + 1);
  unidades.forEach((u) => contar(soDigitos(u.inep)));
  p.unidades?.linhas.forEach((l) => contar(soDigitos(l[CABECALHOS_UNIDADE.inep] ?? '')));
  const inepUnico = (inep: string) => !!inep && contagemInep.get(inep) === 2;
  unidades.forEach(indexarUnidade);
  const idsUnidades = unidades.map((u) => u.id);
  const camposU = CABECALHOS_UNIDADE as Record<keyof Omit<Unidade, 'id'>, string>;
  const tU = p.unidades;
  if (tU) {
    const visto = new Set<string>();
    tU.linhas.forEach((l, i) => {
      const nome = l[camposU.nome];
      if (!nome) {
        avisos.push(`${tU.aba}: linha ${i + 1} sem ${camposU.nome} foi ignorada.`);
        return;
      }
      const inep = soDigitos(l[camposU.inep] ?? '');
      const existente = porNome.get(chave(nome)) ?? (inepUnico(inep) ? porInep.get(inep) : undefined);
      const k = existente?.id ?? `${inep}|${chave(nome)}`;
      if (visto.has(k)) {
        avisos.push(`${tU.aba}: "${nome}" aparece mais de uma vez; só a primeira linha foi usada.`);
        return;
      }
      visto.add(k);
      const conv = { vigencia_ato: data, data_atualizacao: data, inep: soDigitos } as Partial<Record<keyof Unidade, (v: string) => string>>;
      if (existente) {
        const depois = mesclar(existente, l, camposU, tU.presentes, conv);
        const campos = comparar(existente, depois, { ...camposU });
        if (campos.length) plano.unidades.alterados.push({ antes: existente, depois, campos });
        else plano.unidades.iguais++;
        const pos = unidades.findIndex((u) => u.id === existente.id);
        unidades[pos] = depois;
        indexarUnidade(depois);
      } else {
        const id = proximoId('UN', idsUnidades);
        idsUnidades.push(id);
        const nova = mesclar({ id } as Unidade, l, camposU, tU.presentes, conv);
        const completa = { ...Object.fromEntries(Object.keys(camposU).map((c) => [c, ''])), ...nova } as Unidade;
        plano.unidades.novos.push(completa);
        unidades.push(completa);
        indexarUnidade(completa);
      }
    });
  }
  const unidadePorNome = (nome: string) => porNome.get(chave(nome));

  // ---- Plano de Visita Técnica (aba "Plano de Auditoria" nas planilhas antigas)
  const auditorias = [...atual.auditorias];
  const audPorId = new Map(auditorias.map((a) => [a.id, a]));
  const tA = p.auditorias;
  const mapaA: Partial<Record<keyof Auditoria, string>> = {
    tipo: RP.tipo, prioridade: RP.prioridade, data_planejada: RP.dataPlanejada, data_realizada: RP.dataRealizada,
    equipe: RP.equipe, situacao: RP.situacao, observacoes: RP.observacoes,
  };
  if (tA) {
    const visto = new Set<string>();
    tA.linhas.forEach((l, i) => {
      const id = idAuditoria(l[RP.id] ?? '');
      if (!id) {
        avisos.push(`${tA.aba}: linha ${i + 1} sem ${RP.id} foi ignorada.`);
        return;
      }
      if (visto.has(id)) {
        avisos.push(`${tA.aba}: ${id} aparece mais de uma vez; só a primeira linha foi usada.`);
        return;
      }
      visto.add(id);
      const existente = audPorId.get(id);
      let unidade_id = existente?.unidade_id ?? '';
      if (tA.presentes.has(RP.unidade) && l[RP.unidade]) {
        const u = unidadePorNome(l[RP.unidade]);
        if (u) unidade_id = u.id;
        else if (!existente) {
          avisos.push(`${tA.aba}: ${id} ignorada, pois a unidade "${l[RP.unidade]}" não existe no Cadastro Unidades.`);
          return;
        } else avisos.push(`${tA.aba}: ${id} manteve a unidade atual, pois "${l[RP.unidade]}" não existe no Cadastro Unidades.`);
      }
      const conv = { data_planejada: data, data_realizada: data };
      const base: Auditoria = existente ?? { id, unidade_id, tipo: '', prioridade: '', data_planejada: '', data_realizada: '', equipe: '', situacao: '', observacoes: '', iniciada: false };
      const depois = { ...mesclar(base, l, mapaA, tA.presentes, conv), unidade_id };
      if (existente) {
        const campos = comparar(existente, depois, { unidade_id: RP.unidade, ...mapaA });
        if (campos.length) {
          campos.forEach((c) => {
            if (c.rotulo === RP.unidade) {
              c.de = unidades.find((u) => u.id === c.de)?.nome ?? c.de;
              c.para = unidades.find((u) => u.id === c.para)?.nome ?? c.para;
            }
          });
          plano.auditorias.alterados.push({ antes: existente, depois, campos });
        } else plano.auditorias.iguais++;
      } else {
        if (!unidade_id) {
          avisos.push(`${tA.aba}: ${id} ignorada, pois não tem unidade.`);
          return;
        }
        plano.auditorias.novos.push(depois);
      }
      const pos = auditorias.findIndex((a) => a.id === id);
      if (pos >= 0) auditorias[pos] = depois;
      else auditorias.push(depois);
      audPorId.set(id, depois);
    });
  }

  // ---- Auditoria Documental
  const tD = p.avaliacoes;
  if (tD) {
    const atuais = new Map(atual.avaliacoes.map((a) => [`${a.auditoria_id}|${a.item}`, a]));
    const iniciar = new Set<string>();
    const ocorrencia = new Map<string, number>();
    const vistos = new Set<string>();
    tD.linhas.forEach((l, i) => {
      const aud = idAuditoria(l[RD.id] ?? '');
      if (!audPorId.has(aud)) {
        avisos.push(`${tD.aba}: linha ${i + 1} ignorada, pois ${RD.id} "${l[RD.id] ?? ''}" não existe no Plano de Visita Técnica.`);
        return;
      }
      const texto = chave(l[RD.item] ?? '');
      const n = (ocorrencia.get(`${aud}|${texto}`) ?? 0) + 1;
      ocorrencia.set(`${aud}|${texto}`, n);
      const def = LISTA_MESTRA.filter((x) => chave(x.item) === texto || chave(x.codigo) === texto)[n - 1];
      if (!def) {
        avisos.push(`${tD.aba}: linha ${i + 1} ignorada, pois o item "${l[RD.item] ?? ''}" não consta na Lista Mestra.`);
        return;
      }
      iniciar.add(aud);
      const k = `${aud}|${def.codigo}`;
      if (vistos.has(k)) return;
      vistos.add(k);
      const existente = atuais.get(k);
      const base: Avaliacao = existente ?? { auditoria_id: aud, item: def.codigo, situacao: 'Não avaliado', evidencia: '', achado: '', requer_acao: '', prazo: '', responsavel: '', situacao_acao: '' };
      const mapa: Partial<Record<keyof Avaliacao, string>> = {
        situacao: RD.situacao, evidencia: RD.evidencia, achado: RD.achado, requer_acao: RD.requerAcao,
        prazo: RD.prazo, responsavel: RD.responsavel, situacao_acao: RD.situacaoAcao,
      };
      const depois = mesclar(base, l, mapa, tD.presentes, { prazo: data });
      if (!depois.situacao) depois.situacao = 'Não avaliado';
      if (!SITUACOES_ITEM.includes(depois.situacao as SituacaoItem)) {
        avisos.push(`${tD.aba}: ${aud} / ${def.codigo}: situação "${depois.situacao}" não é uma das opções da planilha; foi mantida como veio.`);
      }
      if (existente) {
        const campos = comparar(existente, depois, mapa);
        if (campos.length) plano.avaliacoes.alterados.push({ antes: existente, depois, campos });
        else plano.avaliacoes.iguais++;
      } else if (comparar({ ...base, requer_acao: depois.requer_acao === 'Não' ? 'Não' : base.requer_acao }, depois, mapa).length) {
        plano.avaliacoes.novos.push(depois);
      } else plano.avaliacoes.iguais++;
    });
    // Auditorias com itens preenchidos passam a constar como iniciadas.
    for (const aud of iniciar) {
      const a = audPorId.get(aud)!;
      if (a.iniciada) continue;
      const depois = { ...a, iniciada: true };
      audPorId.set(aud, depois);
      const jaNovo = plano.auditorias.novos.findIndex((x) => x.id === aud);
      if (jaNovo >= 0) plano.auditorias.novos[jaNovo] = depois;
      else {
        const j = plano.auditorias.alterados.findIndex((x) => x.antes.id === aud);
        if (j >= 0) plano.auditorias.alterados[j].depois = depois;
        else {
          plano.auditorias.alterados.push({ antes: a, depois, campos: [{ rotulo: 'Auditoria Documental', de: 'não iniciada', para: 'iniciada' }] });
          if (plano.auditorias.iguais) plano.auditorias.iguais--;
        }
      }
    }
  }

  // ---- Plano de Ação
  const tP = p.acoes;
  if (tP) {
    const acoes = new Map(atual.acoes.map((a) => [a.id, a]));
    const ids = atual.acoes.map((a) => a.id);
    const mapa: Partial<Record<keyof Acao, string>> = {
      auditoria_id: RA.auditoria, item: RA.item, achado: RA.achado, acao: RA.acao, prioridade: RA.prioridade,
      responsavel: RA.responsavel, data_abertura: RA.dataAbertura, prazo: RA.prazo, situacao: RA.situacao,
      evidencia: RA.evidencia, data_conclusao: RA.dataConclusao, validacao: RA.validacao,
    };
    const vistos = new Set<string>();
    tP.linhas.forEach((l, i) => {
      const idLido = (l[RA.id] ?? '').trim();
      if (idLido && vistos.has(idLido)) {
        avisos.push(`${tP.aba}: ${idLido} aparece mais de uma vez; só a primeira linha foi usada.`);
        return;
      }
      if (idLido) vistos.add(idLido);
      const existente = idLido ? acoes.get(idLido) : undefined;
      const aud = l[RA.auditoria] ? idAuditoria(l[RA.auditoria]) : '';
      let unidade_id = existente?.unidade_id ?? '';
      if (tP.presentes.has(RA.unidade) && l[RA.unidade]) unidade_id = unidadePorNome(l[RA.unidade])?.id ?? unidade_id;
      if (!unidade_id && aud) unidade_id = audPorId.get(aud)?.unidade_id ?? '';
      if (!unidade_id) {
        avisos.push(`${tP.aba}: linha ${i + 1} ignorada, pois a unidade "${l[RA.unidade] ?? ''}" não existe no Cadastro Unidades.`);
        return;
      }
      const linha = { ...l, [RA.auditoria]: aud };
      const id = existente?.id ?? idLido ?? '';
      const base: Acao = existente ?? { id, auditoria_id: '', unidade_id, item: '', achado: '', acao: '', prioridade: '', responsavel: '', data_abertura: '', prazo: '', situacao: 'Não iniciada', evidencia: '', data_conclusao: '', validacao: 'Pendente' };
      const depois = { ...mesclar(base, linha, mapa, tP.presentes, { prazo: data, data_abertura: data, data_conclusao: data }), unidade_id };
      if (aud && !audPorId.has(aud)) {
        avisos.push(`${tP.aba}: ${idLido || `linha ${i + 1}`} referencia ${aud}, que não existe no Plano de Visita Técnica; o vínculo foi deixado em branco.`);
        depois.auditoria_id = existente?.auditoria_id ?? '';
      }
      if (existente) {
        const campos = comparar(existente, depois, { unidade_id: RA.unidade, ...mapa });
        campos.forEach((c) => {
          if (c.rotulo === RA.unidade) {
            c.de = unidades.find((u) => u.id === c.de)?.nome ?? c.de;
            c.para = unidades.find((u) => u.id === c.para)?.nome ?? c.para;
          }
        });
        if (campos.length) plano.acoes.alterados.push({ antes: existente, depois, campos });
        else plano.acoes.iguais++;
      } else {
        if (!depois.id) {
          depois.id = proximoId('AC', ids);
        }
        ids.push(depois.id);
        plano.acoes.novos.push(depois);
      }
    });
  }

  return plano;
}

export const totalMudancas = (p: Plano) =>
  (['unidades', 'auditorias', 'avaliacoes', 'acoes'] as const).reduce((s, k) => s + p[k].novos.length + p[k].alterados.length, 0);

/** Registros a gravar, na ordem que respeita os vínculos entre tabelas. */
export function registrosParaGravar(p: Plano): Snapshot {
  const lista = <T,>(r: ResumoTabela<T>) => [...r.novos, ...r.alterados.map((a) => a.depois)];
  return { unidades: lista(p.unidades), auditorias: lista(p.auditorias), avaliacoes: lista(p.avaliacoes), acoes: lista(p.acoes) };
}
