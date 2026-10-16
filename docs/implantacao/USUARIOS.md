# Gerenciamento de usuários (Supabase)

Este guia vale para o **banco compartilhado (Supabase)**. No modo local não há login.

## Como o acesso funciona

Entrar no sistema exige **duas coisas, as duas feitas por você no painel do Supabase**:

| # | O quê | Onde | Para quê |
|---|---|---|---|
| 1 | **Criar a conta** (e-mail e senha) | *Authentication → Users* | A pessoa consegue fazer login |
| 2 | **Autorizar o e-mail** | *SQL Editor* → tabela `membros` | A pessoa consegue ver e alterar os dados |

Com só o passo 1, a pessoa entra, mas vê a mensagem **"O e-mail … ainda não está autorizado"** e nenhum dado.
Com só o passo 2, ela não consegue entrar. Os dois precisam ter **o mesmo e-mail** (maiúsculas e minúsculas não importam; espaços e letras diferentes importam).

A autorização é verificada pelo próprio banco a cada leitura e gravação, então não dá para burlá-la pelo navegador.

> Os nomes dos menus abaixo são os do painel do Supabase na data deste guia e podem mudar um pouco. Os comandos SQL não mudam.

---

## Adicionar uma pessoa

### Passo 1 — Criar a conta

1. Abra o projeto em <https://supabase.com/dashboard> → menu **Authentication** → **Users**.
2. Clique em **Add user** → **Create new user**.
3. Preencha **Email** e **Password** (use uma senha forte e informe-a à pessoa por um canal seguro).
4. Deixe marcada a opção **Auto Confirm User**. Sem ela, a conta fica "aguardando confirmação" e o login é recusado.
5. Clique em **Create user**.

### Passo 2 — Autorizar o e-mail

1. Abra o **SQL Editor** → **New query**.
2. Cole o comando abaixo, trocando o e-mail e o nome, e clique em **Run**:

```sql
insert into public.membros (email, nome)
values ('nome@semec.belem.pa.gov.br', 'Nome da pessoa')
on conflict (email) do nothing;
```

O resultado esperado é **"Success. No rows returned"**.

Para autorizar várias pessoas de uma vez:

```sql
insert into public.membros (email, nome) values
  ('pessoa1@semec.belem.pa.gov.br', 'Pessoa 1'),
  ('pessoa2@semec.belem.pa.gov.br', 'Pessoa 2'),
  ('pessoa3@semec.belem.pa.gov.br', 'Pessoa 3')
on conflict (email) do nothing;
```

### Passo 3 — Conferir

```sql
select email, nome, criado_em from public.membros order by email;
```

A pessoa já pode entrar em o endereço do site (Cloudflare) com o e-mail e a senha definidos. Se ela estava com a tela de "não autorizado" aberta, basta atualizar a página (`F5`).

---

## Administradores

Membros com `admin = true` atualizam o **Panorama de Matrícula** (as turmas de cada ano, em *Dados e planilhas → Turmas e checklists*). O
banco recusa a gravação de quem não é administrador, mesmo que a tela seja burlada. O `supabase/schema.sql` já cadastra como administrador
**marcelinocoelho.diplan@gmail.com**; falta só criar o usuário dele no Passo 1 (*Authentication → Users → Add user*, com esse e-mail).

```sql
-- Tornar administrador (a pessoa precisa estar em membros)
update public.membros set admin = true where lower(email) = lower('nome@semec.belem.pa.gov.br');

-- Tirar de administrador (continua com acesso normal)
update public.membros set admin = false where lower(email) = lower('nome@semec.belem.pa.gov.br');

-- Quem é administrador
select email, nome from public.membros where admin order by email;
```

A pessoa vê "(administrador)" ao lado do e-mail em *Dados e planilhas* depois de entrar de novo. No modo local (sem Supabase) todos são administradores.

## Remover o acesso de uma pessoa

Faça os dois passos (o segundo impede novo login):

```sql
delete from public.membros where lower(email) = lower('nome@semec.belem.pa.gov.br');
```

Depois, em **Authentication → Users**, clique em **⋯** ao lado do usuário → **Delete user**.

Assim que a linha sai de `membros`, a pessoa deixa de ver e de gravar dados, mesmo que ainda esteja com o site aberto.

## Trocar ou redefinir a senha

- **Pelo painel (recomendado):** *Authentication → Users* → **⋯** ao lado do usuário → defina uma nova senha (ou **Send password recovery** para enviar um link por e-mail). Informe a nova senha à pessoa.
- Para o link de recuperação funcionar, em *Authentication → URL Configuration* o **Site URL** deve ser o endereço do site na Cloudflare.
- O envio de e-mails do plano gratuito tem limite baixo por hora; para poucas pessoas, definir a senha pelo painel é mais simples.

## Listar quem tem acesso

```sql
-- Quem está autorizado
select email, nome, criado_em from public.membros order by email;

-- Contas criadas que ainda NÃO foram autorizadas
select u.email, u.created_at
from auth.users u
left join public.membros m on lower(m.email) = lower(u.email)
where m.email is null
order by u.created_at;
```

## Corrigir um e-mail digitado errado

```sql
-- remove espaços e padroniza em minúsculas
update public.membros set email = lower(trim(email));

-- troca um e-mail específico
update public.membros
set email = 'correto@semec.belem.pa.gov.br'
where lower(email) = lower('errado@semec.belem.pa.gov.br');
```

Lembre de que a conta em *Authentication → Users* também precisa ter o e-mail correto (edite o usuário em **⋯**).

## Problemas comuns

| O que aparece | Causa provável | O que fazer |
|---|---|---|
| **"E-mail ou senha incorretos."** | Senha errada, e-mail diferente do cadastrado ou conta ainda não confirmada | Confira o e-mail em *Authentication → Users*; marque/aplique **Auto Confirm** ou redefina a senha |
| **"O e-mail … ainda não está autorizado."** | Conta criada, mas sem linha em `membros` | Execute o `insert` do passo 2; confira com o `select` do passo 3 |
| Entra, mas o painel aparece **zerado** | Banco ainda sem dados | Em **Dados e planilhas**, use **Carregar dados da planilha** (só na primeira vez) |
| Erro ao carregar dados após ficar dias sem usar | Projeto gratuito do Supabase pausado por inatividade | No painel do Supabase, clique em **Restore project**; os dados são mantidos |
| Alguém consegue se cadastrar sozinho | Cadastro aberto ligado | *Authentication → Sign In / Providers* → desative **Allow new users to sign up** (mesmo assim, sem autorização em `membros` ela não vê dados) |

## Boas práticas (LGPD)

- Autorize apenas quem precisa trabalhar com o instrumento; o cadastro tem nomes, telefones e matrículas de servidores.
- Use e-mails institucionais e senhas fortes; evite contas compartilhadas, pois cada alteração registra **quem** a fez.
- Remova o acesso de quem muda de função ou sai da coordenadoria.
- Mantenha desativado o cadastro aberto de novos usuários.
