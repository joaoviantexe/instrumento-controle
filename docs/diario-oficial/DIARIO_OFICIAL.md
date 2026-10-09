# Diário Oficial → unidades (associação automática)

Ferramenta de linha de comando que baixa o Diário Oficial do Município de Belém, procura os atos que citam as unidades do
cadastro e **sugere** a associação (documento, tipo e página). Nada é gravado no sistema sem revisão.

## Como o diário é acessado

O site (`sistemas.belem.pa.gov.br`) recusa conexões de servidores em nuvem e de fora do Brasil. Por isso o **coletor precisa rodar
num computador com acesso ao site** (o seu PC, por exemplo). Ele usa a API do próprio painel:

- lista: `GET /diario-consulta-api/diarios?start=0&rows=100` (JSON com `id`, `data_publicacao`, `attr_stream_name`)
- PDF: `GET /diario-consulta-api/diarios/{id}`

## Uso (Node 20+)

```bash
npm install
npm run diario:coletar -- --limite 10          # baixa as 10 edições mais novas para ./diario-pdfs
npm run diario:coletar                         # baixa todas; pode parar (Ctrl+C) e rodar de novo: continua de onde parou
npm run diario:analisar -- diario-pdfs         # lê os PDFs e grava diario-saida/sugestoes.json e duvidosos.json
```

- `sugestoes.json`: atos associados a uma unidade, com `unidade_id`, `confianca` (`alta` = INEP no texto; `média` = só o nome),
  `tipo_documento`, `numero`, `pagina_inicial`/`pagina_final`, `finalidade` (criação, extinção, autorização…) e o `trecho` do ato.
- `duvidosos.json`: atos que falam de escola mas não casaram com nenhuma unidade — são os que valem a leitura pelo Claude ou a revisão manual.

## Limites desta versão

- A associação é por regras (INEP, depois nome da unidade); não usa IA. Nomes antigos de escolas sem INEP no texto caem em `duvidosos.json`.
- PDFs escaneados (edições antigas) não têm texto e ainda não passam por OCR.
- O endereço do painel não abre o PDF no navegador (a mesma URL devolve o PDF só com o cabeçalho `Accept` do painel). Para o site,
  o Worker da Cloudflare entrega a edição em `/diario/<número>.pdf` e o link abre na página do ato — veja
  [ATOS_DE_CRIACAO.md](ATOS_DE_CRIACAO.md#o-link-para-a-página-do-diário).
