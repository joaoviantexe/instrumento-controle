# Armazenamento dos anexos no Cloudflare R2 (gratuito até 10 GB)

> **Situação atual:** o site guarda os PDFs no **Supabase Storage** (1 GB gratuito). Os passos 1 a 4 abaixo preparam a conta
> e o *bucket* do Cloudflare e **não alteram o site**. Para o site passar a gravar no R2 é preciso o passo 5 (uma pequena
> função intermediária, ainda **não implementada**). Os valores e nomes de menu da Cloudflare são de memória e podem mudar.

## Quanto cabe (gratuito) e quanto custa depois

- **Gratuito:** 10 GB de armazenamento por mês, 1 milhão de gravações/listagens e 10 milhões de leituras. Baixar arquivos não é cobrado.
- **Acima disso:** cerca de US$ 0,015 por GB/mês (100 GB ≈ US$ 1,35; 1 TB ≈ US$ 15).
- É necessário cadastrar um **cartão** mesmo para usar só a parte gratuita.

## Passo a passo

1. **Criar a conta:** em cloudflare.com → *Sign up* → confirme o e-mail. Use um e-mail que **não dependa de uma só pessoa** (por exemplo, um e-mail do projeto).
2. **Ativar o R2:** no painel, menu **R2 Object Storage** → *Get started / Purchase R2* → informe o cartão. (Fica R$ 0 enquanto estiver dentro dos 10 GB.)
3. **Criar o bucket:** *Create bucket* → nome `instrumento-cde-anexos` → localização *Automatic*. **Não** ative o acesso público (o bucket deve ficar **privado**).
4. **Criar as chaves de acesso:** R2 → *Manage R2 API Tokens* → *Create API token* → permissão **Object Read & Write**, restrita ao bucket criado → guarde **Access Key ID**, **Secret Access Key** e o **endereço** (`https://<ID_DA_CONTA>.r2.cloudflarestorage.com`) em um gerenciador de senhas. **Nunca** coloque essas chaves no código nem no GitHub.
5. **Ligar o site ao R2 (a desenvolver):** como as chaves não podem ficar no navegador, cria-se um *Cloudflare Worker* (gratuito) que recebe o PDF, confere o login do Supabase e grava/entrega o arquivo no bucket. No site, bastará configurar o endereço desse Worker. Depois disso, os PDFs hoje no Supabase podem ser copiados para o R2.
6. **Alerta de custo:** Cloudflare → *Notifications* → crie um aviso de uso do R2 e acompanhe também a barra **Armazenamento dos anexos** em *Dados e planilhas*.

## Limitador: para não passar da cota gratuita

O R2 **cobra automaticamente** o que passar dos limites gratuitos (não existe "teto" que interrompa a cobrança). Por isso o site tem **trava própria**:

- **Bloqueio de novos anexos aos 95% do limite** configurado (`VITE_LIMITE_ARMAZENAMENTO_GB`). A mensagem explica o motivo; arquivos **idênticos** a um já guardado continuam sendo aceitos (não ocupam espaço novo).
- **Aviso aos 80%** em *Dados e planilhas* e, ao atingir o bloqueio, também ao lado do botão **Anexar PDF**.
- **Configure com folga:** para os 10 GB gratuitos do R2, use `VITE_LIMITE_ARMAZENAMENTO_GB=9` (o bloqueio ocorre então em cerca de 8,5 GB).
- **Operações (Classe A/B):** os limites (1 milhão de gravações e 10 milhões de leituras por mês) são muito maiores do que um órgão usa — cada anexo gasta poucas operações. Mesmo assim, acompanhe no painel da Cloudflare.

**Limites desta trava (leia):** ela roda no navegador e conta só os PDFs registrados no sistema. Ela **não** impede quem tiver as chaves do R2 de gravar direto no bucket. A proteção definitiva exige a função intermediária (Worker, passo 5), que poderá recusar gravações no servidor, e um **alerta de uso/cobrança** na Cloudflare (*Notifications*). Mantenha as chaves em segredo.

## Medidor de armazenamento no site

Em **Dados e planilhas → Armazenamento dos anexos (PDF)** aparece a **porcentagem usada e disponível**, o tamanho em uso, quantos anexos e
quantos arquivos distintos existem. O limite padrão é **1 GB** (Supabase gratuito). Ao usar o R2, defina na Vercel (*Settings → Environment Variables*)
`VITE_LIMITE_ARMAZENAMENTO_GB=10` e faça um novo deploy. Acima de 80% o site mostra um aviso.
O medidor conta só os PDFs anexados (não o banco de dados) e já desconta os arquivos idênticos.
