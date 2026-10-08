# Armazenamento dos anexos no Cloudflare R2 (gratuito até 10 GB)

> **Situação:** por padrão o site guarda os PDFs no **Supabase Storage** (1 GB gratuito). Com o **Worker** (código pronto em
> [`worker/index.js`](../worker/index.js)) e a variável `VITE_ANEXOS_URL`, os novos PDFs passam a ir para o **R2**. Os valores e nomes de menu da Cloudflare são de memória e podem mudar.

## Quanto cabe (gratuito) e quanto custa depois

- **Gratuito:** 10 GB de armazenamento por mês, 1 milhão de gravações/listagens e 10 milhões de leituras. Baixar arquivos não é cobrado.
- **Acima disso:** cerca de US$ 0,015 por GB/mês (100 GB ≈ US$ 1,35; 1 TB ≈ US$ 15).
- É necessário cadastrar um **cartão** mesmo para usar só a parte gratuita.

## Passo a passo

1. **Criar a conta:** em cloudflare.com → *Sign up* → confirme o e-mail. Use um e-mail que **não dependa de uma só pessoa** (por exemplo, um e-mail do projeto).
2. **Ativar o R2:** no painel, menu **R2 Object Storage** → *Get started / Purchase R2* → informe o cartão. (Fica R$ 0 enquanto estiver dentro dos 10 GB.)
3. **Criar o bucket:** *Create bucket* → nome `instrumento-cde-anexos` → localização *Automatic*. **Não** ative o acesso público (o bucket deve ficar **privado**).
4. **Criar as chaves de acesso:** R2 → *Manage R2 API Tokens* → *Create API token* → permissão **Object Read & Write**, restrita ao bucket criado → guarde **Access Key ID**, **Secret Access Key** e o **endereço** (`https://<ID_DA_CONTA>.r2.cloudflarestorage.com`) em um gerenciador de senhas. **Nunca** coloque essas chaves no código nem no GitHub.
5. **Ligar o site ao R2 (Worker):** veja a seção **"Ligar o site ao R2"** logo abaixo.
6. **Alerta de custo:** Cloudflare → *Notifications* → crie um aviso de uso do R2 e acompanhe também a barra **Armazenamento dos anexos** em *Dados e planilhas*.

## Ligar o site ao R2 (Worker)

O Worker é uma pequena função gratuita da Cloudflare que fica entre o site e o bucket. Ele **confere o login do Supabase**, **recusa** gravações/leituras acima dos
limites do mês, confere se o arquivo é um PDF íntegro e entrega o PDF por um link que **expira em 2 minutos**. Ele acessa o bucket por uma ligação direta
(*binding*), por isso **não usa** as chaves (Access Key/Secret) criadas no passo 4: você pode apagar esse token (R2 → *Manage API Tokens*) para reduzir risco.

**A. Atualizar o banco (Supabase)** — rode o `supabase/schema.sql` inteiro de novo (SQL Editor → colar → *Run*). Ele cria a coluna `destino`, a tabela `uso_operacoes`
e as funções que contam gravações/leituras do mês e o espaço usado no R2. Não apaga dados.

**B. Criar o Worker**
1. Cloudflare → **Workers & Pages** → **Create** → **Create Worker** → nome `instrumento-cde-anexos` → **Deploy** (com o código de exemplo).
2. Clique em **Edit code**, apague tudo, cole o conteúdo do arquivo [`worker/index.js`](../worker/index.js) e clique em **Deploy**.
3. Em **Settings → Bindings → Add → R2 bucket**: *Variable name* `BUCKET`, bucket `instrumento-cde-anexos` → salvar.
4. Em **Settings → Variables and Secrets**, adicione:
   | Nome | Tipo | Valor |
   |---|---|---|
   | `SUPABASE_URL` | Texto | endereço do projeto Supabase |
   | `SUPABASE_ANON_KEY` | Texto | chave *anon/publishable* (a mesma do site) |
   | `ORIGENS` | Texto | endereço(s) do site, sem barra final (ex.: `https://instrumento-controle.vercel.app`), separados por vírgula |
   | `LINK_SECRET` | **Secret** | texto aleatório longo (30+ caracteres) |
   | `LIMITE_BYTES` | Texto | `9663676416` (9 GB, com folga sobre os 10 GB gratuitos) |
   | `LIMITE_A` | Texto | `900000` (gravações/mês; gratuito: 1 milhão) |
   | `LIMITE_B` | Texto | `9000000` (leituras/mês; gratuito: 10 milhões) |
5. Anote o endereço do Worker (algo como `https://instrumento-cde-anexos.<seu-subdominio>.workers.dev`).

**C. Ligar o site**
1. Na hospedagem do site (Vercel ou Cloudflare Pages) → variáveis de ambiente: `VITE_ANEXOS_URL` = endereço do Worker (sem barra final) e
   `VITE_LIMITE_ARMAZENAMENTO_GB` = `9`. Publique de novo.
2. Entre no site → **Dados e planilhas**. Aparecem as barras de **gravações** e **leituras** do mês. Se houver anexos no Supabase, aparece o botão
   **Mover anexos para o Cloudflare R2** (copia cada arquivo, confere e só então apaga do Supabase; se algum limite for atingido, ele para e informa).
3. Teste: anexe um PDF em uma unidade, abra-o e confira no painel da Cloudflare (bucket → *Objects*) que o arquivo apareceu.

**Segurança do Worker:** só responde a quem está logado **e** consta na tabela `membros`; só aceita PDF de até 10 MB cujo conteúdo confere com o hash;
só libera CORS para os endereços de `ORIGENS`. Os limites são verificados **no servidor**, a cada operação, com contagem compartilhada por toda a equipe.
Não coloque o `LINK_SECRET` em lugar nenhum além dos *Secrets* do Worker.

## Limitador: para não passar da cota gratuita

O R2 **cobra automaticamente** o que passar dos limites gratuitos (não existe "teto" que interrompa a cobrança). Por isso o site tem **trava própria**:

- **Bloqueio de novos anexos aos 95% do limite** configurado (`VITE_LIMITE_ARMAZENAMENTO_GB`). A mensagem explica o motivo; arquivos **idênticos** a um já guardado continuam sendo aceitos (não ocupam espaço novo).
- **Aviso aos 80%** em *Dados e planilhas* e, ao atingir o bloqueio, também ao lado do botão **Anexar PDF**.
- **Configure com folga:** para os 10 GB gratuitos do R2, use `VITE_LIMITE_ARMAZENAMENTO_GB=9` (o bloqueio ocorre então em cerca de 8,5 GB).
- **Operações (Classe A/B):** os limites (1 milhão de gravações e 10 milhões de leituras por mês) são muito maiores do que um órgão usa — cada anexo gasta poucas operações. Mesmo assim, acompanhe no painel da Cloudflare.

**Dois níveis de proteção:** (1) a trava do navegador acima (aviso e bloqueio imediatos); (2) o **Worker**, que repete a verificação **no servidor** e também limita **gravações (classe A)** e **leituras (classe B)** por mês, contando em conjunto o uso de toda a equipe. Quem usar as chaves do R2 por fora do site não passa por nenhum dos dois: por isso o Worker não usa essas chaves (apague o token) e vale criar um **alerta de uso/cobrança** na Cloudflare (*Notifications*).

## Medidor de armazenamento no site

Em **Dados e planilhas → Armazenamento dos anexos (PDF)** aparece a **porcentagem usada e disponível**, o tamanho em uso, quantos anexos e
quantos arquivos distintos existem. O limite padrão é **1 GB** (Supabase gratuito). Ao usar o R2, defina na Vercel (*Settings → Environment Variables*)
`VITE_LIMITE_ARMAZENAMENTO_GB=10` e faça um novo deploy. Acima de 80% o site mostra um aviso.
O medidor conta só os PDFs anexados (não o banco de dados) e já desconta os arquivos idênticos.
