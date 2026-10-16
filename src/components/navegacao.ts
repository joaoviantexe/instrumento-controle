import {
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileBarChart,
  Home,
  LayoutDashboard,
  ListChecks,
  School,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { TEXTOS } from '../data/planilha';

export interface Secao {
  rota: string;
  rotulo: string;
  icone: LucideIcon;
  /** Subtítulo da aba correspondente na planilha. */
  descricao: string;
  /** Seções do mesmo grupo ficam juntas no menu, separadas dos outros por uma linha. */
  grupo: number;
}

/** Seções do sistema, na mesma ordem das abas da planilha. */
export const SECOES_APP: Secao[] = [
  { rota: '/', rotulo: 'Início', icone: Home, descricao: TEXTOS.dashboard.subtitulo, grupo: 0 },
  { rota: '/instrucoes', rotulo: 'Instruções', icone: BookOpen, descricao: TEXTOS.instrucoes.subtitulo, grupo: 0 },
  { rota: '/unidades', rotulo: 'Cadastro Unidades', icone: School, descricao: TEXTOS.cadastro.subtitulo, grupo: 1 },
  { rota: '/lista-mestra', rotulo: 'Lista Mestra', icone: ListChecks, descricao: TEXTOS.listaMestra.subtitulo, grupo: 1 },
  { rota: '/plano-de-visita-tecnica', rotulo: 'Plano de Visita Técnica', icone: CalendarCheck, descricao: TEXTOS.planoAuditoria.subtitulo, grupo: 2 },
  { rota: '/auditoria-documental', rotulo: 'Auditoria Documental', icone: ClipboardCheck, descricao: TEXTOS.auditoriaDocumental.subtitulo, grupo: 2 },
  { rota: '/checklist-da-visita', rotulo: 'Checklist da Visita', icone: ClipboardList, descricao: TEXTOS.checklistVisita.subtitulo, grupo: 2 },
  { rota: '/plano-de-acao', rotulo: 'Plano de Ação', icone: Wrench, descricao: TEXTOS.planoAcao.subtitulo, grupo: 3 },
  { rota: '/dashboard', rotulo: 'Dashboard', icone: LayoutDashboard, descricao: TEXTOS.dashboard.subtitulo, grupo: 3 },
  { rota: '/relatorios', rotulo: 'Relatórios', icone: FileBarChart, descricao: TEXTOS.relatorios.subtitulo, grupo: 3 },
  { rota: '/dados', rotulo: 'Dados e planilhas', icone: Database, descricao: 'Exportação para Excel e atualização dos dados por planilha.', grupo: 4 },
];

/** Rota de cada passo do fluxo recomendado (aba Instruções). */
export const ROTAS_PASSOS = [
  '/unidades',
  '/plano-de-visita-tecnica',
  '/auditoria-documental',
  '/instrucoes#criterios',
  '/checklist-da-visita',
  '/lista-mestra',
  '/plano-de-acao',
  '/dashboard',
];
