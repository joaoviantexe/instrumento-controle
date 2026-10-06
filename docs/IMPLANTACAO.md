# Guia de implantação (Vercel + Supabase, custo zero)

A aplicação é um site estático (Vite + React). A hospedagem fica na **Vercel** e, se a equipe for trabalhar em conjunto,
os dados ficam no **Supabase** — ambos com plano gratuito. Não é preciso criar servidor.

| Opção | Quando usar | Custo |
|---|---|---|
| **A. Somente Vercel (modo local)** | Teste, demonstração ou uso individual. Os dados ficam no navegador de cada pessoa. | Gratuito |
| **B. Vercel + Supabase (banco compartilhado)** | Uso real em equipe: dados únicos, login e histórico de quem alterou. | Gratuito (planos *free*) |

Recomendado para uso real: **B**. Siga os passos 1 a 4 abaixo; para a opção A basta o passo 3 sem variáveis de ambiente.

---

## 1. Criar o banco no Supabase (opção B)

1. Crie uma conta em <https://supabase.com> e clique em **New project** (região mais próxima, ex.: *South America (São Paulo)*).
   Anote a senha do banco (não é usada pela aplicação).
2. No menu **SQL Editor**, clique em **New query**, cole **todo** o conteúdo de [`supabase/schema.sql`](../supabase/schema.sql) e clique em **Run**.
   O script cria as tabelas (`unidades`, `auditorias`, `avaliacoes`, `acoes`, `membros`), as regras de segurança (RLS)
   e o registro automático de *quem* e *quando* alterou. Pode ser executado de novo sem perder dados.
3. **Crie os usuários da equipe**: *Authentication → Users → Add user → Create new user*, informe e-mail e senha e marque **Auto Confirm User**.
4. **Autorize cada e-mail** (SQL Editor):
   ```sql
   insert into public.membros (email, nome)
   values ('nome@semec.belem.pa.gov.br', 'Nome da pessoa');
   ```
   Só e-mails listados em `membros` conseguem ler ou gravar dados — mesmo que alguém consiga criar uma conta.
   Passo a passo detalhado (incluindo remover pessoas, redefinir senha e resolver erros de acesso): **[USUARIOS.md](USUARIOS.md)**.
5. **Desative o cadastro aberto**: *Authentication → Sign In / Providers* (ou *Settings*) → desmarque **Allow new users to sign up**.
6. Copie as credenciais em *Project Settings → API*: **Project URL** e a chave **anon / publishable**.

> A chave `anon` é pública por projeto: ela vai no navegador. A proteção dos dados é feita pelas regras RLS do passo 2.
> **Nunca** use a chave `service_role` na aplicação.

## 2. Publicar o código no GitHub

O repositório já está no GitHub (`joaoviantexe/instrumento-controle`). Faça *merge* do branch com a aplicação na `main`
(ou publique a partir do próprio branch).

## 3. Publicar na Vercel

1. Em <https://vercel.com/new>, entre com o GitHub e **importe** o repositório `instrumento-controle`.
2. A Vercel detecta **Vite** automaticamente (o arquivo [`vercel.json`](../vercel.json) já define `npm run build` e a pasta `dist`
   e as regras para as rotas da aplicação). Não precisa alterar nada.
3. Em **Environment Variables**, para a opção B, adicione (em *Production* e *Preview*):

   | Nome | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | *Project URL* do Supabase |
   | `VITE_SUPABASE_ANON_KEY` | chave *anon / publishable* |

   Para a opção A, não adicione nada.
4. Clique em **Deploy**. Ao terminar, a Vercel mostra o endereço (`https://….vercel.app`); depois é possível associar um domínio próprio em *Settings → Domains*.

**Alternativa — integração Supabase da Vercel:** em *Storage* (ou no *Marketplace*) do projeto Vercel, conecte o Supabase.
A integração cria o projeto e injeta as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`, que a aplicação também reconhece.
Mesmo assim, o passo 1.2 a 1.5 (executar o `schema.sql`, criar usuários e autorizar e-mails) continua necessário.

> As variáveis são embutidas no momento do *build*. Se alterá-las depois, faça um novo deploy (*Deployments → ⋯ → Redeploy*).

## 4. Primeiro acesso

1. Abra o endereço publicado e entre com um e-mail autorizado (barra cinza mostra **Banco compartilhado**).
2. Em **Dados e backup**, clique em **Carregar dados da planilha**. Isso grava as 217 unidades e as 217 auditorias da planilha original.
   (Se já usava o modo local, em vez disso use **Restaurar cópia** com o `.json` gerado no computador antigo.)
3. Pronto: a equipe já pode atualizar o cadastro, planejar e avaliar auditorias.

---

## Manutenção

- **Cópias de segurança**: baixe periodicamente em *Dados e backup → Baixar cópia* (`.json`) e/ou *Exportar Excel*.
  No Supabase, *Database → Backups* mostra o que o plano oferece.
- **Atualizações do código**: cada *push* na `main` gera um novo deploy automaticamente.
- **Adicionar/remover pessoas e redefinir senhas**: veja [USUARIOS.md](USUARIOS.md).
- **Redefinir senha**: *Authentication → Users → ⋯ → Send password recovery* (configure o *Site URL* em *Authentication → URL Configuration* com o endereço da Vercel).

## Limites e cuidados dos planos gratuitos

- **Supabase (free)**: 500 MB de banco — o instrumento completo, com as 217 auditorias avaliadas (~11,5 mil registros), usa uma fração disso.
  Projetos gratuitos sem nenhuma atividade por cerca de uma semana são **pausados**; basta clicar em *Restore* no painel do Supabase (os dados são mantidos).
  Confirme os limites atuais em <https://supabase.com/pricing>.
- **Vercel (Hobby)**: os termos do plano gratuito restringem o uso a projetos pessoais e sem fins comerciais. Confirme em
  <https://vercel.com/legal/terms> se o uso institucional da SEMEC é permitido; caso não seja, a mesma aplicação pode ser publicada
  em qualquer hospedagem de arquivos estáticos (gera apenas a pasta `dist`) ou em plano pago.
- **Dados pessoais**: o cadastro contém nomes, telefones e matrículas de servidores. Mantenha o cadastro aberto desativado, use senhas fortes e
  autorize apenas quem precisa (LGPD).

## Rodando no seu computador

```bash
npm install
npm run dev            # http://localhost:5173 (modo local, sem login)
npm test               # testes dos cálculos
npm run build          # gera a pasta dist
```

Para testar com o Supabase, copie `.env.example` para `.env.local` e preencha as duas variáveis.

### Teste de integração com banco real (opcional)

`src/lib/backend/supabase.integracao.test.ts` valida o acesso aos dados (leitura paginada, *upsert*, exclusão em cascata e bloqueio de
quem não é membro) contra um PostgREST/Supabase real. Ele só roda quando as variáveis abaixo estão definidas — use um projeto de testes, **nunca o de produção**,
pois o teste apaga e recarrega os dados:

```bash
SUPABASE_TESTE_URL=… SUPABASE_TESTE_ANON=<jwt anon> SUPABASE_TESTE_MEMBRO=<jwt de um membro> \
SUPABASE_TESTE_INTRUSO=<jwt de um usuário não autorizado> npx vitest run
```
