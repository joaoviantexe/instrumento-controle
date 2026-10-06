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
  /** Exibida nas abas superiores. */
  aba: boolean;
}

/** Seções do sistema, na mesma ordem das abas da planilha. */
export const SECOES_APP: Secao[] = [
  { rota: '/', rotulo: 'Início', icone: Home, descricao: TEXTOS.dashboard.subtitulo, aba: true },
  { rota: '/instrucoes', rotulo: 'Instruções', icone: BookOpen, descricao: TEXTOS.instrucoes.subtitulo, aba: true },
  { rota: '/unidades', rotulo: 'Cadastro Unidades', icone: School, descricao: TEXTOS.cadastro.subtitulo, aba: true },
  { rota: '/lista-mestra', rotulo: 'Lista Mestra', icone: ListChecks, descricao: TEXTOS.listaMestra.subtitulo, aba: true },
  {
    rota: '/plano-de-auditoria',
    rotulo: 'Plano de Auditoria',
    icone: CalendarCheck,
    descricao: TEXTOS.planoAuditoria.subtitulo,
    aba: true,
  },
  {
    rota: '/auditoria-documental',
    rotulo: 'Auditoria Documental',
    icone: ClipboardCheck,
    descricao: TEXTOS.auditoriaDocumental.subtitulo,
    aba: true,
  },
  {
    rota: '/checklist-da-visita',
    rotulo: 'Checklist da Visita',
    icone: ClipboardList,
    descricao: TEXTOS.checklistVisita.subtitulo,
    aba: true,
  },
  { rota: '/plano-de-acao', rotulo: 'Plano de Ação', icone: Wrench, descricao: TEXTOS.planoAcao.subtitulo, aba: true },
  { rota: '/dashboard', rotulo: 'Dashboard', icone: LayoutDashboard, descricao: TEXTOS.dashboard.subtitulo, aba: true },
  { rota: '/relatorios', rotulo: 'Relatórios', icone: FileBarChart, descricao: TEXTOS.relatorios.subtitulo, aba: true },
  {
    rota: '/dados',
    rotulo: 'Dados e backup',
    icone: Database,
    descricao: 'Exportação para Excel, cópia de segurança e restauração.',
    aba: false,
  },
];

/** Rota de cada passo do fluxo recomendado (aba Instruções). */
export const ROTAS_PASSOS = [
  '/unidades',
  '/plano-de-auditoria',
  '/auditoria-documental',
  '/instrucoes#criterios',
  '/checklist-da-visita',
  '/lista-mestra',
  '/plano-de-acao',
  '/dashboard',
];
