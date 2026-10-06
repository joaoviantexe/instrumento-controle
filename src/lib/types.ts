export type SituacaoItem =
  | 'Conforme'
  | 'Parcialmente conforme'
  | 'Não conforme'
  | 'Não se aplica'
  | 'Não avaliado';

export interface Unidade {
  id: string;
  distrito: string;
  bairro: string;
  rede: string;
  inep: string;
  nome: string;
  situacao: string;
  tipo_unidade: string;
  distrito_anexo: string;
  tipo_predio: string;
  tipo_contrato: string;
  zona: string;
  endereco: string;
  numero: string;
  complemento: string;
  cep: string;
  telefone: string;
  email: string;
  ato_criacao: string;
  ato_autorizacao: string;
  /** Data ISO (AAAA-MM-DD) ou texto livre, como "DEFINITIVO". */
  vigencia_ato: string;
  diretor: string;
  contato: string;
  matricula: string;
  secretario: string;
  matricula2: string;
  data_atualizacao: string;
  observacoes: string;
}

export interface ItemLista {
  codigo: string;
  secao: string;
  item: string;
  evidencia: string;
  abrangencia: string;
  criticidade: string;
  peso: number;
  origem: string;
  responsavel: string;
  orientacao: string;
}

export interface Auditoria {
  id: string;
  unidade_id: string;
  tipo: string;
  prioridade: string;
  data_planejada: string;
  data_realizada: string;
  equipe: string;
  situacao: string;
  observacoes: string;
  /** Verdadeiro quando o bloco de 53 itens da Auditoria Documental foi aberto. */
  iniciada: boolean;
}

/** Registro de um item da Auditoria Documental (linha da planilha). */
export interface Avaliacao {
  auditoria_id: string;
  item: string;
  situacao: SituacaoItem;
  evidencia: string;
  achado: string;
  requer_acao: string;
  prazo: string;
  responsavel: string;
  situacao_acao: string;
}

export interface Acao {
  id: string;
  auditoria_id: string;
  unidade_id: string;
  item: string;
  achado: string;
  acao: string;
  prioridade: string;
  responsavel: string;
  data_abertura: string;
  prazo: string;
  situacao: string;
  evidencia: string;
  data_conclusao: string;
  validacao: string;
}

export interface Snapshot {
  unidades: Unidade[];
  auditorias: Auditoria[];
  avaliacoes: Avaliacao[];
  acoes: Acao[];
}
