/** Montagem das abas exportadas para Excel, com os mesmos cabeçalhos da planilha original. */
import {
  ITEM_POR_CODIGO,
  CABECALHOS_LISTA,
  CABECALHOS_UNIDADE,
  LISTA_MESTRA,
  ROTULOS_ACAO,
  ROTULOS_AUDITORIA_DOC,
  ROTULOS_PLANO,
  TEXTOS,
} from '../data/planilha';
import { diasRestantes, linhasDaAuditoria, matrizBairroDistrito, matrizSecoes, distribuicaoDistritos, type Linha } from './calc';
import type { Aba, Coluna } from './exportar';
import type { Dados } from './store';
import type { Acao, Auditoria, Unidade } from './types';

const CAMPOS_UNIDADE = Object.keys(CABECALHOS_UNIDADE) as (keyof typeof CABECALHOS_UNIDADE)[];

export function abaUnidades(unidades: Unidade[]): Aba {
  const larguras: Partial<Record<string, number>> = { nome: 54, endereco: 34, complemento: 34, email: 34, ato_criacao: 40, ato_autorizacao: 40, diretor: 32, secretario: 32, observacoes: 40 };
  return {
    nome: 'Cadastro Unidades',
    titulo: TEXTOS.cadastro.titulo,
    subtitulo: TEXTOS.cadastro.subtitulo,
    colunas: CAMPOS_UNIDADE.map((c) => ({
      cabecalho: CABECALHOS_UNIDADE[c],
      largura: larguras[c],
      tipo: c === 'data_atualizacao' || c === 'vigencia_ato' ? 'data' : 'texto',
    })),
    linhas: unidades.map((u) => CAMPOS_UNIDADE.map((c) => u[c])),
  };
}

export function abaListaMestra(): Aba {
  const campos = Object.keys(CABECALHOS_LISTA) as (keyof typeof CABECALHOS_LISTA)[];
  return {
    nome: 'Lista Mestra',
    titulo: TEXTOS.listaMestra.titulo,
    subtitulo: TEXTOS.listaMestra.subtitulo,
    colunas: campos.map((c) => ({
      cabecalho: CABECALHOS_LISTA[c],
      tipo: c === 'peso' ? 'numero' : 'texto',
      largura: { item: 50, evidencia: 50, orientacao: 60, secao: 30, origem: 34 }[c as string],
    })),
    linhas: LISTA_MESTRA.map((i) => campos.map((c) => i[c])),
  };
}

export function abaPlano(d: Dados, auditorias: Auditoria[]): Aba {
  const r = ROTULOS_PLANO;
  const colunas: Coluna[] = [
    { cabecalho: r.id },
    { cabecalho: r.unidade, largura: 54 },
    { cabecalho: r.distrito },
    { cabecalho: r.tipo, largura: 32 },
    { cabecalho: r.prioridade },
    { cabecalho: r.dataPlanejada, tipo: 'data' },
    { cabecalho: r.dataRealizada, tipo: 'data' },
    { cabecalho: r.equipe, largura: 28 },
    { cabecalho: r.situacao },
    { cabecalho: r.previstos, tipo: 'numero' },
    { cabecalho: r.avaliados, tipo: 'numero' },
    { cabecalho: r.indice, tipo: 'pct' },
    { cabecalho: r.ncCriticas, tipo: 'numero' },
    { cabecalho: r.checklist, tipo: 'pct' },
    { cabecalho: r.observacoes, largura: 40 },
  ];
  return {
    nome: 'Plano de Visita Técnica',
    titulo: TEXTOS.planoAuditoria.titulo,
    subtitulo: TEXTOS.planoAuditoria.subtitulo,
    colunas,
    linhas: auditorias.map((a) => {
      const u = d.unidadePorId.get(a.unidade_id);
      const s = d.resumos.get(a.id);
      return [
        a.id,
        u?.nome,
        u?.distrito,
        a.tipo,
        a.prioridade,
        a.data_planejada,
        a.data_realizada,
        a.equipe,
        a.situacao,
        s?.previstos,
        s?.avaliados,
        s?.indice,
        s?.ncCriticas,
        s?.checklist,
        a.observacoes,
      ];
    }),
  };
}

function linhaAuditoriaDoc(a: Auditoria, u: Unidade | undefined, l: Linha) {
  return [
    a.id,
    a.data_realizada || a.data_planejada,
    u?.nome,
    u?.distrito,
    a.equipe,
    u?.bairro,
    l.def.secao,
    l.def.item,
    l.def.evidencia,
    l.def.peso,
    l.situacao,
    l.evidencia,
    l.pesoAplicavel,
    l.pontos,
    l.indice,
    l.achado,
    l.requer_acao,
    l.prazo,
    l.responsavel,
    l.situacao_acao,
  ];
}

export function abaAuditoriaDocumental(d: Dados, auditorias: Auditoria[]): Aba {
  const r = ROTULOS_AUDITORIA_DOC;
  const colunas: Coluna[] = [
    { cabecalho: r.id },
    { cabecalho: r.data, tipo: 'data' },
    { cabecalho: r.unidade, largura: 50 },
    { cabecalho: r.distrito },
    { cabecalho: r.auditor, largura: 24 },
    { cabecalho: r.bairro, largura: 22 },
    { cabecalho: r.secao, largura: 30 },
    { cabecalho: r.item, largura: 50 },
    { cabecalho: r.evidenciaEsperada, largura: 50 },
    { cabecalho: r.peso, tipo: 'numero' },
    { cabecalho: r.situacao, largura: 22 },
    { cabecalho: r.evidencia, largura: 36 },
    { cabecalho: r.pesoAplicavel, tipo: 'numero' },
    { cabecalho: r.pontos, tipo: 'numero' },
    { cabecalho: r.indiceItem, tipo: 'pct' },
    { cabecalho: r.achado, largura: 40 },
    { cabecalho: r.requerAcao },
    { cabecalho: r.prazo, tipo: 'data' },
    { cabecalho: r.responsavel, largura: 24 },
    { cabecalho: r.situacaoAcao },
  ];
  return {
    nome: 'Auditoria Documental',
    titulo: TEXTOS.auditoriaDocumental.titulo,
    subtitulo: TEXTOS.auditoriaDocumental.subtitulo,
    colunas,
    linhas: auditorias
      .filter((a) => a.iniciada)
      .flatMap((a) =>
        linhasDaAuditoria(a.id, d.mapaAvaliacoes).map((l) => linhaAuditoriaDoc(a, d.unidadePorId.get(a.unidade_id), l)),
      ),
  };
}

/** Avaliações por turma (documentos da turma), uma linha por item e turma. Só exportação. */
export function abaAuditoriaTurmas(d: Dados): Aba {
  return {
    nome: 'Auditoria por Turma',
    titulo: 'AUDITORIA DOCUMENTAL — DOCUMENTOS POR TURMA',
    subtitulo: 'Situação de cada documento da turma (relação nominal e documentos dos alunos), turma a turma',
    colunas: [
      { cabecalho: ROTULOS_AUDITORIA_DOC.id },
      { cabecalho: ROTULOS_AUDITORIA_DOC.unidade, largura: 50 },
      { cabecalho: 'Código', largura: 10 },
      { cabecalho: ROTULOS_AUDITORIA_DOC.item, largura: 50 },
      { cabecalho: 'Turma', largura: 12 },
      { cabecalho: ROTULOS_AUDITORIA_DOC.situacao, largura: 22 },
      { cabecalho: 'Verificação da CDE', largura: 24 },
      { cabecalho: 'Declarado pela secretaria', largura: 24 },
      { cabecalho: 'Observação', largura: 40 },
    ],
    linhas: [...d.avaliacoes_turma]
      .sort((a, b) => a.auditoria_id.localeCompare(b.auditoria_id) || a.item.localeCompare(b.item) || a.turma.localeCompare(b.turma))
      .map((a) => [
        a.auditoria_id,
        d.unidadePorId.get(d.auditoriaPorId.get(a.auditoria_id)?.unidade_id ?? '')?.nome,
        a.item,
        ITEM_POR_CODIGO[a.item]?.item,
        a.turma,
        a.situacao,
        a.verificacao === 'Pendente' ? 'Requer verificação da CDE' : a.verificacao === 'Verificado' ? 'Verificado pela CDE' : '',
        a.declarado,
        a.observacao,
      ]),
  };
}

export function abaAcoes(d: Dados, acoes: Acao[]): Aba {
  const r = ROTULOS_ACAO;
  const colunas: Coluna[] = [
    { cabecalho: r.id },
    { cabecalho: r.auditoria },
    { cabecalho: r.unidade, largura: 50 },
    { cabecalho: r.item },
    { cabecalho: r.achado, largura: 40 },
    { cabecalho: r.acao, largura: 40 },
    { cabecalho: r.prioridade },
    { cabecalho: r.responsavel, largura: 24 },
    { cabecalho: r.dataAbertura, tipo: 'data' },
    { cabecalho: r.prazo, tipo: 'data' },
    { cabecalho: r.diasRestantes, tipo: 'numero' },
    { cabecalho: r.situacao },
    { cabecalho: r.evidencia, largura: 36 },
    { cabecalho: r.dataConclusao, tipo: 'data' },
    { cabecalho: r.validacao },
  ];
  return {
    nome: 'Plano de Ação',
    titulo: TEXTOS.planoAcao.titulo,
    subtitulo: TEXTOS.planoAcao.subtitulo,
    colunas,
    linhas: acoes.map((a) => [
      a.id,
      a.auditoria_id,
      d.unidadePorId.get(a.unidade_id)?.nome,
      a.item,
      a.achado,
      a.acao,
      a.prioridade,
      a.responsavel,
      a.data_abertura,
      a.prazo,
      diasRestantes(a.prazo),
      a.situacao,
      a.evidencia,
      a.data_conclusao,
      a.validacao,
    ]),
  };
}

export function abasRelatorios(d: Dados, linhas: Linha[], unidades: Unidade[], auditorias: Auditoria[]): Aba[] {
  const t = TEXTOS.relatorios;
  const matriz = matrizSecoes(linhas);
  const dist = distribuicaoDistritos(unidades);
  const bd = matrizBairroDistrito(unidades);
  return [
    {
      nome: 'Relatórios',
      titulo: t.titulo,
      subtitulo: t.subtitulo,
      colunas: t.secoesCabecalho.map((c, i) => ({
        cabecalho: c,
        largura: i === 0 ? 34 : 14,
        tipo: i === 0 ? 'texto' : i === 7 ? 'pct' : 'numero',
      })),
      linhas: matriz.map((m) => [
        m.secao,
        m.contagem['Conforme'],
        m.contagem['Parcialmente conforme'],
        m.contagem['Não conforme'],
        m.contagem['Não se aplica'],
        m.contagem['Não avaliado'],
        m.total,
        m.indice,
      ]),
    },
    {
      nome: 'Distribuição por distrito',
      titulo: t.distribuicaoTitulo,
      colunas: t.distribuicaoCabecalho.map((c, i) => ({ cabecalho: c, tipo: i === 0 ? 'texto' : i === 4 ? 'pct' : 'numero' })),
      linhas: dist.map((x) => [x.distrito, x.municipal, x.osc, x.total, x.participacao]),
    },
    {
      nome: 'DistritoBairro',
      titulo: 'DistritoBairro',
      colunas: [
        { cabecalho: 'Bairro', largura: 34 },
        ...bd.distritos.map((x) => ({ cabecalho: x, tipo: 'numero' as const })),
        { cabecalho: 'Total', tipo: 'numero' as const },
      ],
      linhas: [
        ...bd.linhas.map((l) => [l.bairro, ...l.contagem, l.total]),
        ['Total', ...bd.totais, bd.total],
      ],
    },
    {
      nome: 'Consolidação das auditorias',
      titulo: t.consolidacaoTitulo,
      colunas: t.consolidacaoCabecalho.map((c, i) => ({
        cabecalho: c,
        largura: i === 1 ? 54 : 16,
        tipo: i >= 3 ? 'pct' : 'texto',
      })),
      linhas: auditorias.map((a) => {
        const s = d.resumos.get(a.id);
        return [a.id, d.unidadePorId.get(a.unidade_id)?.nome, a.situacao, s?.indice, s?.checklist];
      }),
    },
  ];
}
