# Hospedar o site na Cloudflare (passo a passo)

O site é estático (Vite + React): a Cloudflare monta o código do GitHub e o publica. Esta é a única hospedagem suportada pelo projeto.

> **Segurança:** a hospedagem não é o que protege os dados. O que protege é o **login e as regras do Supabase** (tabela `membros` + RLS), a
> **verificação em duas etapas** nas contas e **chaves secretas fora do código**. A Cloudflare acrescenta, sem custo, HTTPS automático e proteção
> contra sobrecarga (DDoS). O plano gratuito permite uso institucional.
>
> Nomes de menus e limites abaixo são de memória e podem mudar: confira em developers.cloudflare.com.

## Limites do plano gratuito (aproximados)
- Acessos e banda para arquivos estáticos: sem limite prático.
- Cerca de 3.000 minutos de build por mês (cada publicação gasta 1 a 3 minutos).
- Até 20 mil arquivos por site e 25 MiB por arquivo (este site tem poucos).

## Passo a passo

### 1. Conta
cloudflare.com → *Sign up*. Use um e-mail do projeto (não de uma só pessoa) e ative a **verificação em duas etapas** (*My Profile → Authentication*).

### 2. Criar o site a partir do GitHub
1. **Workers & Pages** → **Create** → **Import a repository** (ou, na aba *Pages*, **Connect to Git**). Autorize a Cloudflare no GitHub e escolha **somente** `instrumento-controle`.
2. Preencha:

   | Campo | Valor |
   |---|---|
   | Nome | `instrumento-controle` (vira `instrumento-controle.<seu-subdominio>.workers.dev` ou `.pages.dev`) |
   | Branch de produção | `main` |
   | Comando de build | `npm run build` |
   | Pasta de saída (*output directory*) | `dist` |

3. Cadastre as **variáveis de build** (**Settings → Build → Variables and secrets**; no Pages, *Environment variables*). As que começam com `VITE_` são
   embutidas no código **na hora do build**:

   | Nome | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | endereço do projeto Supabase |
   | `VITE_SUPABASE_ANON_KEY` | chave *anon/publishable* (**nunca** a `service_role`) |
   | `VITE_ANEXOS_URL` | endereço do Worker dos anexos (ver [CLOUDFLARE_R2.md](CLOUDFLARE_R2.md)) |
   | `VITE_LIMITE_ARMAZENAMENTO_GB` | `9` (com o R2) |
   | `NODE_VERSION` | `20` |

4. Salve e publique. Ao terminar, abra o endereço do site.
5. **Mudou uma variável?** Publique de novo (*Deployments → ⋯ → Retry build*, ou um novo *push* na `main`): sem novo build, a mudança não entra.

### 3. Autorizar o endereço no Supabase (essencial para o login)
Supabase → **Authentication → URL Configuration**: **Site URL** = endereço do site; **Redirect URLs** = `https://<endereço>/**`.

### 4. Testar
1. Entre com um e-mail autorizado: a barra lateral mostra **Banco compartilhado**.
2. Abra uma rota (`/unidades`) e aperte F5: deve carregar normalmente.
3. Em **Dados e planilhas → Anexos (PDF)**, confira o armazenamento e (com o R2) as barras de gravações e leituras.

### 5. Domínio próprio (opcional)
Seu projeto → **Domains / Custom domains** → adicionar. Se o domínio estiver na Cloudflare o DNS é automático. Depois, atualize a **Site URL** do Supabase e a variável `ORIGENS` do Worker dos anexos.

### 6. Atualizações
Cada *push* na `main` publica uma nova versão automaticamente. Outras branches podem gerar endereços de pré-visualização (desative em *Settings → Build → Branch control*, se preferir).

## Arquivos do repositório que a Cloudflare usa
- `public/_headers`: cache dos arquivos e cabeçalhos de segurança básicos (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy).
