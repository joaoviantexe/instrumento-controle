/**
 * Planilha "Checklist da Secretaria Escolar" de uma unidade, no mesmo formato do modelo
 * (dados/modelos/Checklist_Secretaria_Escolar.xlsx): abas Unidade, Turmas e uma "Checklist - TURMA" por turma.
 * Também lê a planilha devolvida pela secretaria.
 */
import type ExcelJSNs from 'exceljs';
import {
  ITENS_CHECKLIST,
  SECOES_CHECKLIST,
  SITUACOES_CHECKLIST,
  ehItemChecklist,
  ehMarcaCde,
  itemPorRotulo,
  lerSituacao,
  pendentesDaTurma,
  respostaVazia,
  type RespostaItem,
  type RespostasTurma,
} from './checklist';
import { formatarCep, formatarTelefone } from './format';
import { chaveTexto, compararTurmas, decodificarTurma, linhasDaAba, valorCelula, type Turma, type UnidadePanorama } from './panorama';
import type { Unidade } from './types';

type ExcelJS = typeof ExcelJSNs;
type Planilha = ExcelJSNs.Worksheet;

// Cores do modelo (tema do Office): azul "ênfase 1", cinza = branco 15% mais escuro, verde e vermelho do título.
const AZUL = 'FF4472C4';
const CINZA = 'FFD9D9D9';
const BRANCO = 'FFFFFFFF';
const PRETO = 'FF000000';
const VERDE = 'FF00B050';
const VERMELHO = 'FFC00000';

const FINA = { style: 'thin' as const, color: { argb: PRETO } };
const BORDA = { top: FINA, left: FINA, bottom: FINA, right: FINA };
const fundo = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });
const fonte = (negrito = false, cor = PRETO, tamanho = 10) => ({ name: 'Calibri', size: tamanho, bold: negrito, color: { argb: cor } });
const CENTRO = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };

/** Nome da aba da turma (o modelo usa "Checklist - C11101"). */
export const nomeAbaTurma = (turma: string) => `Checklist - ${turma}`.slice(0, 31);
const TURMA_GERAL = 'GERAL';

const numeroOuTexto = (v: string) => (/^\d{1,15}$/.test(v.trim()) ? Number(v) : v);
function dataOuTexto(v: string): Date | string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : v;
}

export interface DadosChecklist {
  unidade: Unidade;
  ano: number;
  /** Turmas da unidade no Panorama de Matrícula do ano. */
  turmas: Turma[];
  /** Linha da unidade no panorama (código da SEMEC, zona, contrato). */
  panorama?: UnidadePanorama;
  /** Respostas já enviadas pela secretaria: entram preenchidas. */
  respostas?: Record<string, RespostasTurma>;
}

/** Campos da aba Unidade, na ordem do modelo, com o campo correspondente do Cadastro. */
export const CAMPOS_ABA_UNIDADE: { rotulo: string; campo: keyof Unidade }[][] = [
  [
    { rotulo: 'Unidade', campo: 'nome' },
    { rotulo: 'Código INEP/MEC', campo: 'inep' },
    { rotulo: 'Distrito', campo: 'distrito' },
    { rotulo: 'Bairro', campo: 'bairro' },
    { rotulo: 'Rede/Vinculo', campo: 'rede' },
    { rotulo: 'Tipo de Unidade', campo: 'tipo_unidade' },
  ],
  [
    { rotulo: 'Endereço', campo: 'endereco' },
    { rotulo: 'Número', campo: 'numero' },
    { rotulo: 'Complemento', campo: 'complemento' },
    { rotulo: 'CEP', campo: 'cep' },
    { rotulo: 'Zona', campo: 'zona' },
    { rotulo: 'Tipo de Prédio', campo: 'tipo_predio' },
    { rotulo: 'Tipo de Contrato', campo: 'tipo_contrato' },
    { rotulo: 'Telefone', campo: 'telefone' },
    { rotulo: 'E-mail', campo: 'email' },
  ],
  [
    { rotulo: 'Diretor', campo: 'diretor' },
    { rotulo: 'Secretário', campo: 'secretario' },
  ],
];
const TITULOS_ABA_UNIDADE = ['Identificação da Unidade', 'Endereço da Unidade', 'Responsáveis da Unidade'];

function valorAbaUnidade(u: Unidade, campo: keyof Unidade): ExcelJSNs.CellValue {
  const v = String(u[campo] ?? '');
  if (campo === 'inep' || campo === 'numero') return numeroOuTexto(v);
  if (campo === 'cep') return v ? formatarCep(v) : '';
  if (campo === 'telefone') return v ? formatarTelefone(v) : '-';
  if (campo === 'email') return v ? { text: v, hyperlink: `mailto:${v}` } : '';
  return v;
}

function abaUnidade(wb: ExcelJSNs.Workbook, u: Unidade) {
  const ws = wb.addWorksheet('Unidade');
  ws.columns = [{ width: 20.71 }, { width: 60.71 }];
  let linha = 1;
  CAMPOS_ABA_UNIDADE.forEach((grupo, g) => {
    ws.mergeCells(linha, 1, linha, 2);
    const t = ws.getCell(linha, 1);
    t.value = TITULOS_ABA_UNIDADE[g];
    t.font = fonte(true, BRANCO);
    t.fill = fundo(AZUL);
    t.alignment = CENTRO;
    t.border = BORDA;
    grupo.forEach(({ rotulo, campo }, i) => {
      linha++;
      const a = ws.getCell(linha, 1);
      const b = ws.getCell(linha, 2);
      a.value = rotulo;
      const valor = valorAbaUnidade(u, campo);
      b.value = valor === '' ? null : valor;
      a.font = fonte(true);
      b.font = campo === 'email' && u.email ? { ...fonte(), color: { argb: 'FF0563C1' }, underline: true } : fonte();
      for (const c of [a, b]) {
        c.alignment = CENTRO;
        c.border = BORDA;
        c.fill = fundo(i % 2 === 1 ? CINZA : BRANCO);
      }
    });
    linha++;
  });
  // Os mesmos nomes do modelo: a coluna Responsável das checklists oferece o diretor e o secretário.
  wb.definedNames.add('Unidade!$B$19', 'Diretor');
  wb.definedNames.add('Unidade!$B$20', 'GestorSecretario');
  wb.definedNames.add('Unidade!$B$20', 'Secretário');
}

/** Campos que identificam a unidade: a planilha não os altera no Cadastro. */
const CAMPOS_IDENTIDADE: (keyof Unidade)[] = ['nome', 'inep'];
const ROTULO_DO_CAMPO = new Map(CAMPOS_ABA_UNIDADE.flat().map((x) => [x.campo, x.rotulo]));

export interface DiferencaCadastro {
  campo: keyof Unidade;
  rotulo: string;
  de: string;
  para: string;
}

/** Valor como o Cadastro guarda (CEP e telefone só com números, textos em maiúsculas, e-mail em minúsculas). */
function paraCadastro(campo: keyof Unidade, v: string): string {
  const t = v.replace(/\s+/g, ' ').trim();
  if (campo === 'cep') return t.replace(/\D/g, '');
  if (campo === 'telefone') return t === '-' ? '' : t.replace(/\D/g, '');
  if (campo === 'email') return t.toLowerCase();
  return t.toLocaleUpperCase('pt-BR');
}

/**
 * O que a aba Unidade da planilha traz de diferente do Cadastro. Célula vazia não apaga nada, e nome e INEP
 * (que identificam a unidade) não mudam por aqui.
 */
export function diferencasCadastro(u: Unidade, lido: Partial<Record<keyof Unidade, string>>): DiferencaCadastro[] {
  const saida: DiferencaCadastro[] = [];
  for (const [campo, bruto] of Object.entries(lido) as [keyof Unidade, string][]) {
    if (CAMPOS_IDENTIDADE.includes(campo)) continue;
    const para = paraCadastro(campo, bruto);
    const de = String(u[campo] ?? '');
    if (!para || chaveTexto(paraCadastro(campo, de)) === chaveTexto(para)) continue;
    saida.push({ campo, rotulo: ROTULO_DO_CAMPO.get(campo) ?? campo, de, para });
  }
  return saida;
}

const CABECALHOS_TURMAS = [
  ['Ano', 10.71], ['Distrito', 10.71], ['Zona', 10.71], ['Bairro', 20.71], ['Tipo de Contrato', 20.71], ['Rede', 14.71], ['Código INEP', 14.71],
  ['Código Unidade', 17.71], ['Unidade', 50.71], ['Ensino', 25.71], ['Série', 20.71], ['Turno', 17.71], ['Turma', 10.71],
  ['Qt Ocupação Turma', 20.71], ['Qt Alunos Turma', 18.71], ['Qt Aluno Não Especial', 20.86], ['Qt Aluno Especial', 20.71],
  ['Qt Ocupação Aluno Especial', 30.71], ['Qt Vagas Restantes', 20.71], ['Alunos', 18.71], ['Nome Geral', 50.71],
] as const;

/** Título da aba da turma, igual ao resultado da fórmula do modelo. */
function tituloTurma(t: Turma | undefined, turma: string, pendentes: number) {
  const situacao = pendentes > 0 ? `${pendentes} itens pendentes` : 'Checklist Conforme';
  return t ? `${t.serie} | ${t.turno} | ${turma} / ${situacao}` : `${turma} / ${situacao}`;
}

function abaTurmas(wb: ExcelJSNs.Workbook, d: DadosChecklist, turmas: Turma[]) {
  const ws = wb.addWorksheet('Turmas');
  ws.columns = CABECALHOS_TURMAS.map(([, w]) => ({ width: w }));
  const p = d.panorama;
  const linhas = turmas.map((t) => {
    const titulo = tituloTurma(t, t.turma, pendentesDaTurma(d.respostas?.[t.turma]));
    return [
      d.ano,
      p?.distrito || d.unidade.distrito,
      p?.zona || d.unidade.zona,
      p?.bairro || d.unidade.bairro,
      p?.tipo_contrato || null,
      p?.rede || d.unidade.rede,
      numeroOuTexto(p?.inep || d.unidade.inep),
      p ? numeroOuTexto(p.codigo) : null,
      p?.nome || d.unidade.nome,
      t.ensino,
      t.serie,
      t.turno,
      t.turma,
      t.ocupacao,
      t.alunos,
      t.nao_especial,
      t.especial,
      t.ocupacao_especial,
      t.vagas,
      'Relação de Alunos ',
      { formula: `'${nomeAbaTurma(t.turma)}'!$A$1`, result: titulo },
    ];
  });
  ws.addTable({
    name: 'Tabela1',
    ref: 'A1',
    headerRow: true,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: CABECALHOS_TURMAS.map(([nome]) => ({ name: nome, filterButton: true })),
    rows: linhas.length ? linhas : [CABECALHOS_TURMAS.map(() => null)],
  });
  const total = Math.max(1, linhas.length) + 1;
  for (let r = 1; r <= total; r++) {
    for (let c = 1; c <= CABECALHOS_TURMAS.length; c++) {
      const cel = ws.getCell(r, c);
      cel.alignment = { horizontal: 'center', vertical: 'middle' };
      cel.border = BORDA;
      if (r === 1) {
        cel.font = fonte(true, BRANCO);
        cel.fill = fundo(AZUL);
      } else {
        cel.font = fonte();
        if (r % 2 === 1) cel.fill = fundo(CINZA);
        // Turma acima da capacidade: vagas em vermelho.
        if (c === 19 && typeof cel.value === 'number' && cel.value < 0) cel.font = fonte(true, VERMELHO);
      }
    }
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function abaChecklist(wb: ExcelJSNs.Workbook, d: DadosChecklist, turma: string, t: Turma | undefined) {
  const ws = wb.addWorksheet(nomeAbaTurma(turma), { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
  ws.columns = [{ width: 60.71 }, { width: 15.71 }, { width: 20.71 }, { width: 10.71 }, { width: 40.71 }, { width: 30.71 }, { width: 10, hidden: true }];
  const respostas = d.respostas?.[turma] ?? {};
  const ultima = 1 + SECOES_CHECKLIST.reduce((s, x) => s + 1 + x.itens.length, 0);

  // Título: série | turno | turma / pendências (fórmula do modelo, com o resultado já calculado).
  ws.mergeCells(1, 1, 1, 6);
  const a1 = ws.getCell('A1');
  const contar = `(COUNTIF(B3:B71,"Não conforme")+COUNTIF(B3:B71,"Não avaliado"))`;
  const situacao = `IF(${contar}>0,${contar}&" itens pendentes","Checklist Conforme")`;
  a1.value = {
    formula: t
      ? `INDEX(Turmas!$K:$K,MATCH("${turma}",Turmas!$M:$M,0))&" | "&INDEX(Turmas!$L:$L,MATCH("${turma}",Turmas!$M:$M,0))&" | "&"${turma}"&" / "&${situacao}`
      : `"${turma}"&" / "&${situacao}`,
    result: tituloTurma(t, turma, pendentesDaTurma(respostas)),
  };
  a1.font = fonte(true, BRANCO, 16);
  a1.fill = fundo(VERDE);
  a1.alignment = { horizontal: 'center', vertical: 'middle' };
  a1.border = BORDA;
  ws.getRow(1).height = 21;

  let linha = 2;
  const faixas: string[] = [];
  for (const secao of SECOES_CHECKLIST) {
    ['' + secao.titulo, 'Situação', 'Ultima Atualização', 'Prazo', 'Responsável', 'Observação'].forEach((texto, i) => {
      const c = ws.getCell(linha, i + 1);
      c.value = texto;
      c.font = fonte(true, BRANCO);
      c.fill = fundo(AZUL);
      c.alignment = CENTRO;
      c.border = BORDA;
    });
    const inicio = linha + 1;
    secao.itens.forEach((item, i) => {
      linha++;
      const r: RespostaItem = { ...respostaVazia(), ...respostas[item.codigo] };
      const valores = [item.rotulo, r.situacao, r.atualizado ? dataOuTexto(r.atualizado) : null, r.prazo ? dataOuTexto(r.prazo) : null, r.responsavel || d.unidade.diretor || null, r.observacao || null];
      valores.forEach((v, j) => {
        const c = ws.getCell(linha, j + 1);
        c.value = v;
        c.font = fonte(j <= 1);
        c.alignment = CENTRO;
        c.border = BORDA;
        if (i % 2 === 1) c.fill = fundo(CINZA);
        if (j === 2 || j === 3) c.numFmt = 'dd/mm/yyyy';
      });
      // Código do item (coluna oculta): a leitura não depende do texto da coluna A.
      ws.getCell(linha, 7).value = item.codigo;
      ws.getCell(linha, 2).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${SITUACOES_CHECKLIST.join(',')}"`],
        showErrorMessage: true,
        errorTitle: 'Situação',
        error: 'Escolha uma situação da lista.',
      };
      ws.getCell(linha, 5).dataValidation = { type: 'list', allowBlank: true, formulae: ['Unidade!$B$19:$B$20'] };
    });
    faixas.push(`B${inicio}:B${linha}`);
    linha++;
  }

  // Vermelho quando há pendência (as mesmas regras do modelo, escritas como fórmula: funcionam em qualquer versão do Excel).
  const vermelho = { font: { color: { argb: BRANCO } }, fill: { type: 'pattern' as const, pattern: 'solid' as const, bgColor: { argb: VERMELHO } } };
  const contem = (texto: string, celula: string) => `NOT(ISERROR(SEARCH("${texto}",${celula})))`;
  ws.addConditionalFormatting({ ref: 'A1:F1', rules: [{ type: 'expression', formulae: [contem('pendente', 'A1')], style: vermelho, priority: 1 }] });
  faixas.forEach((ref, i) => {
    const primeira = ref.split(':')[0];
    ws.addConditionalFormatting({
      ref,
      rules: [
        { type: 'expression', formulae: [contem('Não avaliado', primeira)], style: vermelho, priority: 2 + i * 2 },
        { type: 'expression', formulae: [contem('Não conforme', primeira)], style: vermelho, priority: 3 + i * 2 },
      ],
    });
  });
  ws.pageSetup.printArea = `A1:F${ultima + SECOES_CHECKLIST.length - 1}`;
}

/** Monta a planilha da unidade (recebe o ExcelJS já carregado). */
export function montarChecklist(Excel: ExcelJS, d: DadosChecklist): ExcelJSNs.Workbook {
  const wb = new Excel.Workbook();
  wb.creator = 'Instrumento de Controle da Documentação Escolar — CDE/SEMEC';
  wb.created = new Date();
  const turmas = [...d.turmas].sort(compararTurmas);
  abaUnidade(wb, d.unidade);
  abaTurmas(wb, d, turmas);
  if (turmas.length) for (const t of turmas) abaChecklist(wb, d, t.turma, t);
  else abaChecklist(wb, d, TURMA_GERAL, undefined);
  // Abre na primeira checklist, como o modelo.
  wb.views = [{ x: 0, y: 0, width: 14805, height: 8010, firstSheet: 0, activeTab: 2, visibility: 'visible' }];
  return wb;
}

/** Nome do arquivo: Checklist_Secretaria_Escolar_2026_ESCOLA_MUNICIPAL_....xlsx */
export function nomeArquivoChecklist(u: Pick<Unidade, 'nome'>, ano: number): string {
  const nome = chaveTexto(u.nome).toUpperCase().replace(/ /g, '_').slice(0, 80);
  return `Checklist_Secretaria_Escolar_${ano}_${nome}.xlsx`;
}

export async function gerarChecklistExcel(d: DadosChecklist): Promise<{ buffer: ArrayBuffer; nome: string }> {
  const { default: Excel } = await import('exceljs');
  const buffer = (await montarChecklist(Excel, d).xlsx.writeBuffer()) as ArrayBuffer;
  return { buffer, nome: nomeArquivoChecklist(d.unidade, d.ano) };
}

// ---------------------------------------------------------------- leitura da planilha devolvida

export interface ChecklistLida {
  /** Nome e INEP da aba Unidade (para conferir se é a unidade certa). */
  unidade: { nome: string; inep: string };
  /** Todos os campos preenchidos na aba Unidade (para atualizar o Cadastro). */
  cadastro: Partial<Record<keyof Unidade, string>>;
  /** Ano da aba Turmas (0 quando não informado). */
  ano: number;
  turmas: Record<string, RespostasTurma>;
  avisos: string[];
}

function textoData(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // Data guardada como número de série do Excel.
    return new Date(Date.UTC(1899, 11, 30) + v * 86_400_000).toISOString().slice(0, 10);
  }
  const s = String(v ?? '').trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : s;
}

const texto = (v: unknown) => String(v ?? '').trim();

/** Código da turma de uma aba de checklist: pelo nome da aba ou pelo título (… | C11101 / …). */
function turmaDaAba(nome: string, titulo: string): string {
  const pelaAba = /checklist\s*-\s*(.+)$/i.exec(nome)?.[1]?.trim().toUpperCase();
  if (pelaAba) return pelaAba;
  const peloTitulo = /\|\s*([A-Z][A-Z0-9]\d{4})\s*\//i.exec(titulo)?.[1];
  return (peloTitulo ?? nome).trim().toUpperCase();
}

/**
 * Planilhas salvas por outros programas (o modelo original foi gerado em Python) usam caminhos absolutos nas ligações
 * das abas ("/xl/tables/table1.xml"), que o ExcelJS não resolve. Troca por caminhos relativos antes de abrir.
 */
export async function normalizarXlsx(dados: ArrayBuffer): Promise<ArrayBuffer> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(dados);
  let mudou = false;
  for (const caminho of Object.keys(zip.files).filter((c) => /^xl\/[^/]+\/_rels\/.+\.rels$/.test(c))) {
    const xml = await zip.file(caminho)!.async('string');
    const novo = xml.replace(/Target="\/xl\//g, 'Target="../');
    if (novo !== xml) {
      zip.file(caminho, novo);
      mudou = true;
    }
  }
  return mudou ? zip.generateAsync({ type: 'arraybuffer' }) : dados;
}

/** Abre um .xlsx com o ExcelJS, aceitando também os arquivos salvos por outros programas. */
export async function abrirXlsx(dados: ArrayBuffer): Promise<ExcelJSNs.Workbook> {
  const { default: Excel } = await import('exceljs');
  const wb = new Excel.Workbook();
  await wb.xlsx.load(await normalizarXlsx(dados));
  return wb;
}

/** Lê a checklist preenchida pela secretaria (o arquivo gerado pelo sistema ou o modelo original). */
export async function lerChecklistExcel(arquivo: Blob): Promise<ChecklistLida> {
  return lerChecklistDaPasta(await abrirXlsx(await arquivo.arrayBuffer()));
}

export function lerChecklistDaPasta(wb: ExcelJSNs.Workbook): ChecklistLida {
  const avisos: string[] = [];
  const cadastro: Partial<Record<keyof Unidade, string>> = {};
  const porRotulo = new Map(CAMPOS_ABA_UNIDADE.flat().map((x) => [chaveTexto(x.rotulo), x.campo]));
  const abaU = wb.worksheets.find((w) => chaveTexto(w.name) === 'unidade');
  if (abaU) {
    for (const l of linhasDaAba(abaU)) {
      const campo = porRotulo.get(chaveTexto(l[0]));
      if (campo && !(campo in cadastro) && texto(l[1])) cadastro[campo] = texto(l[1]);
    }
  }
  const unidade = { nome: cadastro.nome ?? '', inep: (cadastro.inep ?? '').replace(/\D/g, '') };
  let ano = 0;
  const abaT = wb.worksheets.find((w) => chaveTexto(w.name) === 'turmas');
  if (abaT) ano = Number(valorCelula(abaT.getCell('A2').value)) || 0;

  const turmas: Record<string, RespostasTurma> = {};
  for (const ws of wb.worksheets) {
    if (ws === abaU || ws === abaT) continue;
    const linhas = linhasDaAba(ws as Planilha);
    // Aba de checklist: tem cabeçalhos de seção com "Situação" na coluna B.
    if (!linhas.some((l) => chaveTexto(l[1]) === 'situacao')) continue;
    const turma = turmaDaAba(ws.name, texto(linhas[0]?.[0]));
    if (turmas[turma]) {
      avisos.push(`A turma ${turma} aparece em mais de uma aba; ficou a primeira.`);
      continue;
    }
    const respostas: RespostasTurma = {};
    let secao = -1;
    linhas.forEach((l, i) => {
      if (chaveTexto(l[1]) === 'situacao') {
        secao++;
        return;
      }
      const rotulo = texto(l[0]);
      if (!rotulo || i === 0) return;
      const oculto = texto(l[6]).toUpperCase();
      const codigo = ehItemChecklist(oculto) ? oculto : itemPorRotulo(rotulo, secao);
      if (!codigo) {
        avisos.push(`${ws.name}, linha ${i + 1}: "${rotulo}" não corresponde a nenhum item da checklist e foi ignorado.`);
        return;
      }
      const situacao = lerSituacao(texto(l[1]));
      if (!situacao) {
        avisos.push(`${ws.name}, linha ${i + 1}: situação "${texto(l[1])}" não reconhecida; o item ficou Não avaliado.`);
      }
      const r: RespostaItem = {
        situacao: situacao ?? 'Não avaliado',
        atualizado: textoData(l[2]),
        prazo: textoData(l[3]),
        responsavel: texto(l[4]),
        // A marca "Avaliado pela CDE" da planilha com dados não é observação da secretaria.
        observacao: ehMarcaCde(texto(l[5])) ? '' : texto(l[5]),
      };
      // Só guarda o que foi preenchido além do padrão (o responsável padrão é o diretor).
      if (r.situacao !== 'Não avaliado' || r.atualizado || r.prazo || r.observacao) respostas[codigo] = r;
    });
    turmas[turma] = respostas;
  }
  if (!Object.keys(turmas).length) throw new Error('nenhuma aba de checklist foi encontrada (abas "Checklist - TURMA", com a coluna Situação).');
  const faltando = ITENS_CHECKLIST.length;
  for (const [t, r] of Object.entries(turmas)) {
    if (!decodificarTurma(t) && t !== TURMA_GERAL) avisos.push(`A aba da turma "${t}" não tem um código de turma do SIGA.`);
    if (Object.keys(r).length === 0) avisos.push(`A turma ${t} não tem nenhum dos ${faltando} itens avaliados.`);
  }
  return { unidade, cadastro, ano, turmas, avisos };
}
