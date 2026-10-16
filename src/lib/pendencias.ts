import { CABECALHOS_UNIDADE as C, ROTULOS_ACAO, ROTULOS_PLANO } from '../data/planilha';
import { acaoAtrasada, vigenciaVencida } from './calc';
import type { Dados } from './store';
import { unidadesComAto } from './anexos';
import { unidadesComResolucaoCme, type MapaConferencias } from './conferencias';
import type { Anexo, Unidade } from './types';

const NAO_LOCALIZADO = 'NÃO LOCALIZADO';

/** Pendências cadastrais (passo 1 das Instruções: atos legais, vigência e responsáveis). */
/** Dados extras que algumas pendências precisam além da própria unidade. */
export interface ContextoPendencia {
  /** Unidades que já têm o ato de autorização: o PDF anexado ou a resolução do CME ligada à unidade. */
  comPdfDoAto: Set<string>;
}

export const contextoPendencia = (anexos: Anexo[], conferencias?: MapaConferencias): ContextoPendencia => ({
  comPdfDoAto: new Set([...unidadesComAto(anexos), ...unidadesComResolucaoCme(undefined, conferencias)]),
});

export const PENDENCIAS: { chave: string; rotulo: string; teste: (u: Unidade, ctx: ContextoPendencia) => boolean }[] = [
  { chave: 'ato_criacao', rotulo: `${C.ato_criacao}: não informado`, teste: (u) => !u.ato_criacao },
  {
    chave: 'ato_autorizacao',
    rotulo: `${C.ato_autorizacao}: não informado ou não localizado`,
    teste: (u) => !u.ato_autorizacao || u.ato_autorizacao.toUpperCase().includes(NAO_LOCALIZADO),
  },
  {
    chave: 'sem_pdf_ato',
    rotulo: `${C.ato_autorizacao}: sem PDF anexado nem resolução do CME`,
    teste: (u, ctx) => !ctx.comPdfDoAto.has(u.id),
  },
  { chave: 'vigencia_vazia', rotulo: `${C.vigencia_ato}: não informada`, teste: (u) => !u.vigencia_ato },
  { chave: 'vigencia_vencida', rotulo: `${C.vigencia_ato}: vencida`, teste: (u) => vigenciaVencida(u.vigencia_ato) },
  { chave: 'diretor', rotulo: `${C.diretor}: não informado`, teste: (u) => !u.diretor },
  { chave: 'secretario', rotulo: `${C.secretario}: não informado`, teste: (u) => !u.secretario || /^SEM SECRET/i.test(u.secretario) },
  { chave: 'telefone', rotulo: `${C.telefone}: não informado`, teste: (u) => !u.telefone },
  { chave: 'email', rotulo: `${C.email}: não informado`, teste: (u) => !u.email },
  { chave: 'data_atualizacao', rotulo: `${C.data_atualizacao}: não informada`, teste: (u) => !u.data_atualizacao },
];

export interface ItemAtencao {
  chave: string;
  /** Quantidade de registros que precisam de atenção. */
  total: number;
  rotulo: string;
  /** Tela (com filtro já aplicado) onde o problema é tratado. */
  para: string;
  /** Contexto curto sobre o que isso mede. */
  detalhe: string;
}

/** O que precisa de atenção agora: reúne, em um só lugar, os problemas que a planilha esconderia em abas diferentes. */
export function itensDeAtencao(d: Dados): ItemAtencao[] {
  const pend = (chave: string) => PENDENCIAS.find((p) => p.chave === chave)!;
  const ctx = contextoPendencia(d.anexos, d.mapaConferencias);
  const nUn = (chave: string) => d.unidades.filter((u) => pend(chave).teste(u, ctx)).length;
  const ncCriticas = d.auditorias.reduce((s, a) => s + (d.resumos.get(a.id)?.ncCriticas ?? 0), 0);
  return [
    {
      chave: 'acoes_vencidas',
      total: d.acoes.filter((a) => acaoAtrasada(a)).length,
      rotulo: `${ROTULOS_ACAO.prazo} expirado`,
      para: '/plano-de-acao?vencidas=1',
      detalhe: 'Ações em aberto com prazo anterior a hoje',
    },
    {
      chave: 'nc_criticas',
      total: ncCriticas,
      rotulo: ROTULOS_PLANO.ncCriticas,
      para: '/plano-de-visita-tecnica?iniciadas=1',
      detalhe: 'Itens de peso 3 classificados como Não conforme',
    },
    {
      chave: 'validacao',
      total: d.acoes.filter((a) => a.situacao === 'Concluída' && a.validacao === 'Pendente').length,
      rotulo: `${ROTULOS_ACAO.validacao}: Pendente`,
      para: '/plano-de-acao?situacao=Concluída&validacao=Pendente',
      detalhe: 'Ações concluídas que aguardam a validação da CDE',
    },
    {
      chave: 'vigencia',
      total: nUn('vigencia_vencida'),
      rotulo: pend('vigencia_vencida').rotulo,
      para: '/unidades?pendencia=vigencia_vencida',
      detalhe: 'Unidades com o ato de funcionamento com a vigência já vencida',
    },
    {
      chave: 'ato_autorizacao',
      total: nUn('ato_autorizacao'),
      rotulo: 'Resolução',
      para: '/unidades?pendencia=ato_autorizacao',
      detalhe: 'Unidades sem ato informado ou marcado como não localizado',
    },
  ];
}
