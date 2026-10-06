import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Moldura } from './components/Layout';
import { Carregando } from './components/ui';
import { criarBackendLocal } from './lib/backend/local';
import { criarBackendSupabase, supabaseConfigurado } from './lib/backend/supabase';
import { DadosProvider, useDados } from './lib/store';
import { SessaoProvider, useSessao } from './lib/sessao';
import { Entrar, SemAcesso } from './pages/Entrar';
import { Inicio } from './pages/Inicio';
import { Instrucoes } from './pages/Instrucoes';
import { Unidades } from './pages/Unidades';
import { UnidadeDetalhe } from './pages/UnidadeDetalhe';
import { ListaMestra } from './pages/ListaMestra';
import { PlanoAuditoria } from './pages/PlanoAuditoria';
import { AuditoriaDocumental } from './pages/AuditoriaDocumental';
import { ChecklistVisita } from './pages/ChecklistVisita';
import { PlanoAcao } from './pages/PlanoAcao';
import { Dashboard } from './pages/Dashboard';
import { Relatorios } from './pages/Relatorios';
import { Dados } from './pages/Dados';
import { NaoEncontrada } from './pages/NaoEncontrada';

const backend = supabaseConfigurado ? criarBackendSupabase() : criarBackendLocal();

function Conteudo() {
  const { carregando, erro, recarregar } = useDados();
  if (carregando) return <Carregando texto="Carregando dados do instrumento…" />;
  if (erro)
    return (
      <div className="container pagina">
        <div className="cartao cartao__corpo">
          <h2 className="titulo-bloco">Não foi possível carregar os dados</h2>
          <p className="texto-muted" style={{ margin: '8px 0 16px' }}>{erro}</p>
          <button type="button" className="btn btn--primario" onClick={() => void recarregar()}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  return (
    <Routes>
      <Route index element={<Inicio />} />
      <Route path="instrucoes" element={<Instrucoes />} />
      <Route path="unidades" element={<Unidades />} />
      <Route path="unidades/:id" element={<UnidadeDetalhe />} />
      <Route path="lista-mestra" element={<ListaMestra />} />
      <Route path="plano-de-auditoria" element={<PlanoAuditoria />} />
      <Route path="auditoria-documental" element={<AuditoriaDocumental />} />
      <Route path="auditoria-documental/:id" element={<AuditoriaDocumental />} />
      <Route path="checklist-da-visita" element={<ChecklistVisita />} />
      <Route path="checklist-da-visita/:id" element={<ChecklistVisita />} />
      <Route path="plano-de-acao" element={<PlanoAcao />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="relatorios" element={<Relatorios />} />
      <Route path="dados" element={<Dados />} />
      <Route path="*" element={<NaoEncontrada />} />
    </Routes>
  );
}

function Portao() {
  const { status } = useSessao();
  if (status === 'carregando')
    return (
      <Moldura>
        <Carregando />
      </Moldura>
    );
  if (status === 'anonimo')
    return (
      <Moldura>
        <Entrar />
      </Moldura>
    );
  if (status === 'nao-autorizado' || status === 'erro')
    return (
      <Moldura>
        <SemAcesso />
      </Moldura>
    );
  return (
    <DadosProvider backend={backend}>
      <Moldura>
        <Conteudo />
      </Moldura>
    </DadosProvider>
  );
}

export function App() {
  return (
    <SessaoProvider>
      <BrowserRouter>
        <Portao />
      </BrowserRouter>
    </SessaoProvider>
  );
}
