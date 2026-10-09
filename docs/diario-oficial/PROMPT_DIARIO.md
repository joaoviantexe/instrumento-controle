# Prompt para escanear o Diário Oficial e associar os atos às unidades

Use no **Claude Code instalado no computador que acessa o diário** (o site recusa servidores em nuvem), dentro da pasta do projeto,
com a branch que contém `scripts/diario/`. Cole o texto abaixo.

---

Você está no repositório `instrumento-controle` (sistema da CDE/SEMEC de Belém). Seu objetivo é associar **cada unidade escolar do
cadastro** (`src/data/planilha.json`, chave `unidades`) aos atos do Diário Oficial do Município de Belém que a citam — decretos,
portarias, resoluções e outros —, registrando o **tipo do documento** e a **página** onde ela é citada, para que a pessoa revisora
abra a edição direto na página.

Este computador tem acesso ao site do diário. Você só cria arquivos em `diario-pdfs/` e `diario-saida/`. Não altere o código do
sistema, o banco de dados nem `planilha.json`.

## Antes de começar

Leia `docs/diario-oficial/DIARIO_OFICIAL.md` e os arquivos de `scripts/diario/` (coletar.mjs, analisar.mjs, regras.mjs, texto.mjs). Eles já fazem a
coleta (retomável) e uma primeira associação por regras (INEP e nome). A fonte é a API do painel:
`GET https://sistemas.belem.pa.gov.br/diario-consulta-api/diarios?start=0&rows=100` (lista, 5.147 edições) e
`GET .../diarios/{id}` (o PDF, que só vem com `Accept: application/octet-stream`; sem isso o site devolve JSON).

## Etapas (siga na ordem; não peça confirmação a cada passo)

0. **Teste.** Rode `npm install` e `npm run diario:coletar -- --limite 10`, depois `npm run diario:analisar -- diario-pdfs`.
   Se o coletor falhar (por exemplo, vier JSON em vez de PDF), investigue os cabeçalhos da requisição e corrija o coletor.
   Escolha 3 sugestões, abra o PDF, leia a página citada e confirme que estão certas. Só siga em frente se estiverem.
1. **Coleta completa.** Rode `npm run diario:coletar` (da edição mais nova para a mais antiga). Ele continua de onde parou. Se o uso do
   plano acabar, salve o estado e diga exatamente como retomar.
2. **Associação por regras.** Rode `npm run diario:analisar -- diario-pdfs`. Edições sem texto (escaneadas) devem ser listadas em
   `diario-saida/sem-texto.json` para tratar depois; não tente adivinhar o conteúdo delas.
3. **Leitura dos atos duvidosos.** Para cada ato de `duvidosos.json` e para cada sugestão de confiança `média`, leia o texto da página
   no PDF e decida se o ato cita alguma unidade do cadastro. Considere nome antigo, sigla (EMEF, EMEI, EMEIF, UEI, UMEI), mudança de
   denominação, endereço, bairro e distrito. Confirme por INEP quando houver. Se não houver unidade, registre "nenhuma".
4. **Atos citados no cadastro.** Para cada unidade, leia `ato_criacao` e `ato_autorizacao` (ex.: "DECRETO Nº 96.781/2020 - PMB, DE 21
   DE JULHO DE 2020"), extraia tipo, número e data, e procure nas edições publicadas na data do ato e nos 10 dias seguintes a página em
   que esse ato aparece com esse número. Registre com `origem: "cadastro"`. Atos que não forem achados vão para `pendentes.json`.
5. **Consolidação.** Gere `diario-saida/associacoes.json` e `associacoes.csv`, sem duplicatas, com um registro por (unidade, ato):

   ```
   unidade_id, unidade_nome, inep,
   tipo_documento (DECRETO | PORTARIA | RESOLUÇÃO | LEI | EXTRATO | OUTRO), numero, data_ato, finalidade,
   edicao_id, edicao_data, arquivo, pagina, referencia ("DOM nº {edicao_id} de dd/mm/aaaa, p. {pagina}"),
   download_url, confianca (alta | média | baixa), origem (inep | nome | cadastro | leitura), trecho, revisado (false)
   ```

   `trecho` é uma **cópia literal** do PDF (até 400 caracteres); nunca parafraseie.
6. **Relatório.** Escreva `diario-saida/RELATORIO.md`: quantas edições foram lidas, quantas sem texto, quantas associações por
   origem e confiança, unidades sem nenhum ato encontrado, atos do cadastro não localizados e 10 associações sorteadas para eu conferir.

## Regras

- Nunca invente número de ato, data, página ou unidade. Na dúvida, use `confianca: "baixa"`; não descarte.
- Uma associação só é `alta` se o INEP aparece no ato, ou se o número e a data do ato batem com o do cadastro.
- Guarde o andamento em `diario-saida/progresso.json` para poder retomar sem refazer o que já foi lido.
- Teste uma vez se o link `download_url` com `#page={pagina}` abre na página certa quando colado no navegador e anote o resultado no
  relatório. Se não abrir, a `referencia` (edição, data e página) é o que vale como link.
- Fale em português. Ao terminar, mostre o caminho dos arquivos e o resumo do relatório.
