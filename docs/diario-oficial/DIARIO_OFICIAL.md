# Diário Oficial → unidades (associação automática)

Duas formas de ler o Diário Oficial do Município de Belém inteiro e achar os atos que tratam das escolas — criação, instituição,
extinção, denominação, mudança de nome, autorização de funcionamento. Nenhuma guarda PDFs: o site abre a edição direto no Diário,
na página do ato. Nada é gravado no sistema sem revisão.

## Varredura pelo navegador (aba "Diário Oficial")

Em **Dados e planilhas → Diário Oficial**, o botão **Iniciar varredura** lê as edições uma a uma, da mais nova para a mais antiga,
dentro do próprio navegador. O PDF passa pelo Worker da Cloudflare (`/diario/edicoes` para a lista e `/diario/<nº>.pdf` para cada
edição) e é lido na hora; só o texto dos atos sobre escolas fica guardado, no próprio navegador.

- Precisa de um computador **no Brasil** (o site da Prefeitura recusa acessos de fora) e do Worker atualizado, com o endereço do site
  em `ORIGENS`.
- Leva algumas horas para as ~5.000 edições. Pode **Pausar** e **Continuar** depois (mesmo fechando a aba): o progresso fica salvo no
  navegador. Os campos "Da edição nº" / "Até a edição nº" limitam a faixa.
- Edições digitalizadas (sem texto) e as que derem erro ficam listadas no resultado para tratar depois.
- **Baixar resultado** gera `varredura-diario-oficial-AAAA-MM-DD.json` com cada ato achado (edição, data, página, tipo, número,
  título e texto). A associação às unidades é feita sobre esse arquivo, com revisão: nomes atuais, nomes antigos e INEP sugerem as
  unidades candidatas; a leitura do texto decide a unidade, a relação (criação, extinção da antecessora, mudança de nome…) e a
  confiança; o resultado entra em `src/data/atos-diario.json` e aparece na página de cada unidade.

## Linha de comando

Ferramenta que baixa o Diário Oficial, procura os atos que citam as unidades do cadastro e **sugere** a associação (documento,
tipo e página).

### Como o diário é acessado

O site (`sistemas.belem.pa.gov.br`) recusa conexões de servidores em nuvem e de fora do Brasil. Por isso o **coletor precisa rodar
num computador com acesso ao site** (o seu PC, por exemplo). Ele usa a API do próprio painel:

- lista: `GET /diario-consulta-api/diarios?start=0&rows=100` (JSON com `id`, `data_publicacao`, `attr_stream_name`)
- PDF: `GET /diario-consulta-api/diarios/{id}`

### Uso (Node 20+)

```bash
npm install
npm run diario:coletar -- --limite 10          # baixa as 10 edições mais novas para ./diario-pdfs
npm run diario:coletar                         # baixa todas; pode parar (Ctrl+C) e rodar de novo: continua de onde parou
npm run diario:analisar -- diario-pdfs         # lê os PDFs e grava diario-saida/sugestoes.json e duvidosos.json
```

- `sugestoes.json`: atos associados a uma unidade, com `unidade_id`, `confianca` (`alta` = INEP no texto; `média` = só o nome),
  `tipo_documento`, `numero`, `pagina_inicial`/`pagina_final`, `finalidade` (criação, extinção, autorização…) e o `trecho` do ato.
- `duvidosos.json`: atos que falam de escola mas não casaram com nenhuma unidade — são os que valem a leitura pelo Claude ou a revisão manual.

### Limites desta versão

- A associação é por regras (INEP, depois nome da unidade); não usa IA. Nomes antigos de escolas sem INEP no texto caem em `duvidosos.json`.
- PDFs escaneados (edições antigas) não têm texto e ainda não passam por OCR.
- O endereço do painel não abre o PDF no navegador (a mesma URL devolve o PDF só com o cabeçalho `Accept` do painel). Para o site,
  o Worker da Cloudflare entrega a edição em `/diario/<número>.pdf` e o link abre na página do ato — veja
  [ATOS_DE_CRIACAO.md](ATOS_DE_CRIACAO.md#o-link-para-a-página-do-diário).
