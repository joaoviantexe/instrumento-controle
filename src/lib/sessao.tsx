import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, supabaseConfigurado, verificarMembro } from './backend/supabase';

export type StatusSessao = 'carregando' | 'anonimo' | 'nao-autorizado' | 'ok' | 'erro';

interface Sessao {
  status: StatusSessao;
  email: string | null;
  /** Administrador (coluna admin da tabela membros): atualiza o panorama de matrícula. No modo local, sempre. */
  admin: boolean;
  mensagem: string | null;
  entrar(email: string, senha: string): Promise<string | null>;
  sair(): Promise<void>;
}

const Contexto = createContext<Sessao | null>(null);

/** No modo local não há login; no modo Supabase, exige usuário autenticado e autorizado. */
export function SessaoProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<StatusSessao>(supabaseConfigurado ? 'carregando' : 'ok');
  const [email, setEmail] = useState<string | null>(null);
  const [admin, setAdmin] = useState(!supabaseConfigurado);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const avaliar = useCallback(async (emailSessao: string | null) => {
    setEmail(emailSessao);
    if (!emailSessao) {
      setAdmin(false);
      setStatus('anonimo');
      return;
    }
    try {
      const r = await verificarMembro();
      setAdmin(r.admin);
      setStatus(r.membro ? 'ok' : 'nao-autorizado');
    } catch (e) {
      setMensagem((e as Error).message);
      setStatus('erro');
    }
  }, []);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    const sb = supabase();
    void sb.auth.getSession().then(({ data }) => avaliar(data.session?.user.email ?? null));
    const { data } = sb.auth.onAuthStateChange((evento, s) => {
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT' || evento === 'USER_UPDATED') {
        // Executado fora do callback para não bloquear o cliente de autenticação.
        window.setTimeout(() => void avaliar(s?.user.email ?? null), 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [avaliar]);

  const entrar = useCallback(async (e: string, senha: string) => {
    const { error } = await supabase().auth.signInWithPassword({ email: e.trim(), password: senha });
    if (!error) return null;
    return error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message;
  }, []);

  const sair = useCallback(async () => {
    if (supabaseConfigurado) await supabase().auth.signOut();
  }, []);

  return (
    <Contexto.Provider value={{ status, email, admin, mensagem, entrar, sair }}>{children}</Contexto.Provider>
  );
}

export function useSessao(): Sessao {
  const v = useContext(Contexto);
  if (!v) throw new Error('useSessao fora de SessaoProvider');
  return v;
}
