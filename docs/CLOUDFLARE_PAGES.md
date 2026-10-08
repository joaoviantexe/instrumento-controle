# Hospedar o site no Cloudflare Pages (passo a passo)

> **Sobre "é mais seguro que a Vercel?"** Não afirmei isso. O que disse é que o plano gratuito do Cloudflare Pages **permite uso comercial**
> (o plano gratuito da Vercel, o *Hobby*, é para uso pessoal/não comercial). Em segurança, os dois são serviços sérios e equivalentes para
> um site estático como este. **O que protege os dados de verdade não é a hospedagem, e sim o login e as regras do Supabase** (tabela `membros` + RLS).
> A Cloudflare acrescenta, sem custo, proteção contra ataques de sobrecarga (DDoS) e certificado HTTPS automático.
>
> Nomes de menus e limites abaixo são de memória e podem mudar: confira na documentação da Cloudflare (developers.cloudflare.com/pages).

## Limites do plano gratuito (aproximados)

- Banda e acessos ao site: **sem limite** para arquivos estáticos.
- **500 builds por mês** (cada vez que o código é publicado).
- Até 20 mil arquivos por site e 25 MiB por arquivo (este site tem poucos arquivos).
- Uso comercial permitido.

## Antes de começar

1. O código precisa estar no **GitHub** (já está: `joaoviantexe/instrumento-controle`).
2. A branch que será publicada (*production branch*) deve ter o código atual. Hoje as mudanças recentes estão na branch
   `claude/vigilant-pascal-tua5f3`; para publicá-las como versão oficial, **junte-a à `main`** (Pull Request no GitHub) ou escolha essa branch como produção.
3. Tenha à mão: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Supabase → *Project Settings → API*). Veja o valor atual na Vercel (*Settings → Environment Variables*).
4. **Mantenha a Vercel funcionando** até terminar os testes. Assim você pode voltar atrás.

## Passo a passo

### 1. Criar a conta
cloudflare.com → *Sign up* → confirme o e-mail. Prefira um e-mail do projeto (não de uma pessoa só) e ative a **verificação em duas etapas** (*My Profile → Authentication*).

### 2. Criar o projeto no Pages
1. No painel: **Workers & Pages** → **Create** → aba **Pages** → **Connect to Git**.
2. Autorize a Cloudflare no GitHub e escolha **somente** o repositório `instrumento-controle`.
3. **Begin setup** e preencha:
   | Campo | Valor |
   |---|---|
   | Project name | `instrumento-controle` (vira `instrumento-controle.pages.dev`) |
   | Production branch | `main` (ou a branch escolhida) |
   | Framework preset | **Vite** (ou *None*) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | (vazio) |
4. Em **Environment variables**, adicione (para *Production*; repita para *Preview* se quiser testar branches):
   | Nome | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | endereço do projeto Supabase |
   | `VITE_SUPABASE_ANON_KEY` | chave *anon/publishable* (**nunca** a `service_role`) |
   | `NODE_VERSION` | `20` |
   | `VITE_LIMITE_ARMAZENAMENTO_GB` | (opcional) limite do medidor de armazenamento |
5. **Save and Deploy**. Aguarde o build (alguns minutos). Ao terminar, abra o endereço `https://instrumento-controle.pages.dev`.

> As variáveis `VITE_…` são embutidas **no momento do build**: se mudar uma, é preciso publicar de novo (*Deployments → Retry deployment*).

### 3. Autorizar o novo endereço no Supabase (essencial para o login)
Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://instrumento-controle.pages.dev` (ou seu domínio próprio);
- **Redirect URLs:** adicione `https://instrumento-controle.pages.dev/**` e, se usar pré-visualizações, `https://*.instrumento-controle.pages.dev/**`.

Sem isso, o login ou a recuperação de senha podem falhar no endereço novo.

### 4. Testar
1. Abra o endereço novo e entre com um e-mail autorizado (a barra lateral deve mostrar **Banco compartilhado**).
2. Navegue direto por uma rota (por exemplo, abra `/unidades` e aperte F5): deve carregar normalmente (o Pages já devolve a página inicial para rotas do site).
3. Confira **Cadastro Unidades**, **Dados e planilhas** (planilha e anexos) e abra um PDF.
4. No navegador (F12 → Rede), confira que a página recebe os cabeçalhos de segurança do arquivo `public/_headers` (X-Content-Type-Options, X-Frame-Options etc.).

### 5. Domínio próprio (opcional)
Pages → seu projeto → **Custom domains** → *Set up a custom domain*. Se o domínio estiver na Cloudflare, o DNS é configurado sozinho; senão, ela indica o registro CNAME. O HTTPS é emitido automaticamente. Depois, atualize o **Site URL** do Supabase (passo 3).

### 6. Publicações automáticas
Cada *push* na *production branch* publica uma nova versão. *Pushes* em outras branches geram um endereço de pré-visualização (útil para testar antes de oficializar). Para desativar as pré-visualizações: *Settings → Builds & deployments → Branch control*.

## Segurança: o que fazer de verdade

- **Duas etapas (2FA)** na Cloudflare, no GitHub e no Supabase.
- Use só a chave **anon** no site; a `service_role` nunca deve aparecer em variável `VITE_…` nem no GitHub.
- Mantenha **RLS** ligado e revise a tabela `membros` (veja [USUARIOS.md](USUARIOS.md)).
- Não publique o bucket de anexos: ele deve continuar **privado** (os links de abertura expiram em 2 minutos).
- Opcional: Cloudflare Access (gratuito até 50 usuários) para exigir um login extra **antes** de abrir o site.

## Voltar atrás (plano B)
Enquanto a Vercel estiver no ar, basta voltar a divulgar o endereço antigo e restaurar a **Site URL** do Supabase. Só desative a Vercel depois de alguns dias sem problemas.

## Resumo Vercel × Cloudflare Pages
| | Vercel (Hobby) | Cloudflare Pages (gratuito) |
|---|---|---|
| Uso comercial/institucional | Não (plano pessoal) | Sim |
| Builds por mês | cerca de 6 mil minutos | 500 builds |
| Banda | limite mensal | ilimitada (estático) |
| Configuração no repositório | `vercel.json` | `public/_headers` |
| Observação | Já em uso | Exige ajustar a URL no Supabase |
