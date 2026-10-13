# Atos de criação no Diário Oficial

> Atualização de 13/10/2026: a varredura completa do Diário acrescentou atos além destes PDFs; veja [VARREDURA_RESULTADO.md](VARREDURA_RESULTADO.md). Os números abaixo são os da primeira leitura (94 PDFs).

Os 94 PDFs da pasta [`dados/atos-de-criacao`](../../dados/atos-de-criacao) foram lidos e cada ato foi associado às unidades do
cadastro. O site **não usa os arquivos**: cada ato aparece na página da unidade (seção **Atos no Diário Oficial**) com um link que
abre a edição do Diário Oficial do Município de Belém (DOM) **já na página do ato**. Nada foi gravado no banco de dados.

## Resumo

| | |
|---|---|
| PDFs lidos | 94 (a maioria com uma ou duas páginas recortadas de uma edição do DOM) |
| Atos encontrados | 119 (decretos, portarias, resoluções do CME e leis), sem repetição |
| Unidades com ao menos um ato | 88 |
| Associações ato → unidade | 123 (110 confirmadas no texto do ato, 9 prováveis, 4 a conferir) |
| Atos com link para a página do DOM | 113 |
| Atos sem link | 6 (ver abaixo) |

Os dados ficam em [`src/data/atos-diario.json`](../../src/data/atos-diario.json). Os testes (`src/lib/diario.test.ts`) conferem que cada
unidade existe no cadastro, que o INEP confere, que a publicação não é anterior ao ato e que cada PDF citado existe.

## Como foi feito

1. **Leitura.** O texto de cada página foi extraído do PDF; onde o PDF não tinha texto (o corpo dos decretos vem desenhado, e
   alguns arquivos são imagens), a página foi lida por OCR (Tesseract, português).
2. **Edição e página.** O número da edição, a data e o número da página foram tirados do cabeçalho de cada página do DOM e
   conferidos visualmente nos casos duvidosos (por exemplo, páginas com dois dígitos e páginas sem texto).
3. **Associação.** Cada ato foi ligado à unidade pelo nome, pelo INEP (quando citado) e pelo endereço. Quando o ato fala de uma
   unidade antiga que deu origem à atual (por exemplo, "antiga UEI Caripunas"), a associação é feita com a unidade atual e a
   relação aparece como *antecessora*.
4. **Atos da mesma página.** Muitas páginas trazem atos de outras escolas do cadastro; eles também foram associados.

## O link para a página do Diário

O painel do Diário (`sistemas.belem.pa.gov.br/diario/painel`) não tem um endereço que abra o PDF no navegador: o mesmo endereço
devolve só os dados da edição, e o PDF vem como download. Por isso o **Worker da Cloudflare** (o mesmo dos anexos) ganhou a rota
pública `GET /diario/<número da edição>.pdf`, que busca a edição no painel e a entrega para o navegador abrir. O link do site é
`<Worker>/diario/15011.pdf?pagina=2#page=2`, que abre a edição 15.011 na página 2.

Para funcionar:

1. **Atualize o código do Worker** dos anexos na Cloudflare: *Workers & Pages → instrumento-cde-anexos → Edit code*, cole o
   conteúdo novo de [`worker/index.js`](../../worker/index.js) e clique em **Deploy**.
2. O site precisa ter a variável `VITE_ANEXOS_URL` (ou `VITE_DIARIO_URL`, se quiser outro Worker). Sem ela, a página da unidade
   mostra a referência (edição, data e página) e um botão para o painel do Diário.
3. **Teste um link.** O site da Prefeitura bloqueia alguns servidores fora do Brasil; se ele recusar o Worker, o link mostra uma
   página explicando como achar a edição no painel. Confira também se a página aberta é a do ato: a numeração impressa no
   cabeçalho foi usada como número da página do PDF da edição.

Duas suposições ainda precisam de confirmação:

- **O "Número" do painel é o número da edição impresso no cabeçalho.** A edição 15.525 do painel é de 07/10/2026, o que bate com
  a sequência das edições lidas, mas confirme uma: no painel, a edição de 16/08/2024 deve ter o número 15.011.
- **A página impressa é a mesma página do PDF da edição.** Isso vale quando a edição não tem caderno suplementar antes da página
  do ato.

## O que conferir

### Associações prováveis ou a conferir

| Unidade | Ato | Situação | Motivo |
|---|---|---|---|
| ESCOLA MUNICIPAL VENUZINA MARINHO DE SOUZA (UN-092) | Portaria 538/2007-PMB — DOM 10.914, 12/06/2007, p. 2–3 | provável | A UEI Cremação ficava na Alcindo Cacela, ao lado do posto policial — mesmo endereço da EMEI Venuzina Marinho de Souza (Decreto 95.218/2019). |
| ESCOLA MUNICIPAL PROFESSORA ROSENIL CORDEIRO DA SILVA (UN-110) | Portaria 543/2007-PMB — DOM 10.914, 12/06/2007, p. 3 | provável | A UEI São Silvestre ficava na Passagem São Silvestre, Jurunas — mesmo endereço da EMEI Profª Rosenil Cordeiro da Silva (Decreto 90.970/2018). |
| ESCOLA MUNICIPAL GENESIS (UN-132) | Portaria 544/2007-PMB — DOM 10.914, 12/06/2007, p. 3 | provável | A UEI Maguari ficava no Conjunto Maguari, Al. 8, casa 21 — mesmo endereço da EMEIF Gênesis, criada no mesmo dia em que a UEI foi extinta (Decretos 82.887 e 82.888/2015). |
| ESCOLA MUNICIPAL PRATINHA (UN-045) | Portaria 545/2007-PMB — DOM 10.914, 12/06/2007, p. 3 | a conferir | UEI Pratinha, na Passagem Santo Afonso. Pode ser a antecessora desta unidade ou da EM Pratinha II — confira. |
| ESCOLA MUNICIPAL PRATINHA II (UN-046) | Portaria 545/2007-PMB — DOM 10.914, 12/06/2007, p. 3 | a conferir | UEI Pratinha, na Passagem Santo Afonso. Pode ser a antecessora desta unidade ou da EM Pratinha — confira. |
| ESCOLA MUNICIPAL PROFESSORA ANGELICA DO CARMO SANTOS PAIVA (UN-021) | Portaria 550/2007-PMB — DOM 10.914, 12/06/2007, p. 4 | provável | A UEI Benguí ficava na Rua São Bento, perto do Mercado Novo — mesmo endereço da EMEI Profª Angélica do Carmo Santos Paiva (Decreto 95.488/2020). |
| ESCOLA MUNICIPAL PROFESSORA ALDA EUTROPIO DE SOUZA (UN-058) | Portaria 0.629/2010-GABS — DOM 11.650, 30/06/2010, p. 3 | provável | O endereço coincide com o da EM Profª Alda Eutrópio de Souza (Alameda Sucupira, entre a Rua São Clemente). Confirme se é a antiga EMEIF Tapanã. |
| ESCOLA MUNICIPAL GENESIS (UN-132) | Decreto 82.888/2015-PMB — DOM 12.825, 11/06/2015, p. 5 | provável | A UEI Maguari funcionava no mesmo endereço da EMEIF Gênesis, criada no mesmo dia. |
| ESCOLA MUNICIPAL DE EDUCACAO DO CAMPO SEBASTIAO DOS SANTOS QUARESMA (UN-184) | Portaria 0.973/2019-GABS/SEMEC — DOM 13.719, 26/03/2019, p. 6 | provável | A extinção vale desde 01/02/2019, a mesma data de início da EMEC Sebastião dos Santos Quaresma, na Ilha do Combu. |
| ANEXO SANTO ANTONIO DA EM DE EDUC DO CAMPO SEBASTIAO DOS S QUARESMA (UN-181) | Decreto 93.155/2019-PMB — DOM 13.726, 04/04/2019, p. 2 | provável | O cadastro cita este decreto também para o anexo; o anexo foi instituído pela Portaria 0.974/2019. |
| ESCOLA MUNICIPAL PRATINHA (UN-045) | Decreto 94.449/2019-PMB — DOM 13.831, 12/09/2019, p. 2 | a conferir | Decreto de 2019 que cria uma "nova EMEI Pratinha". Pode ser desta unidade ou da EM Pratinha II — confira. |
| ESCOLA MUNICIPAL PRATINHA II (UN-046) | Decreto 94.449/2019-PMB — DOM 13.831, 12/09/2019, p. 2 | a conferir | Decreto de 2019 que cria uma "nova EMEI Pratinha". Pode ser desta unidade ou da EM Pratinha — confira. |
| ESCOLA MUNICIPAL PARQUE BOLONHA (UN-067) | Portaria 1.076/2024-GABS/SEMEC — DOM 14.956, 23/05/2024, p. 11 | provável | O INEP desta unidade no cadastro (15161560) é o do Anexo UP Bolonha, extinto por esta portaria. Confira a situação da unidade no cadastro. |

### Atos sem link para o Diário

| Ato | Motivo |
|---|---|
| ~~Portaria 1.221/2009-GABS/SEMEC (Rita Nery)~~ | **Resolvido** pela varredura de 13/10/2026: é a edição 11.523, de 15/12/2009. |
| Decreto 97.641/2020-PMB (Perpétuo Socorro Jesus Figueiredo) | O PDF é uma cópia digitalizada do decreto assinado, não uma página do DOM. **Falta descobrir a edição e a página** em que foi publicado (provavelmente entre 27 e 30/10/2020). |
| Lei 7.183/1981 (Augusto Meira Filho), Lei 7.481/1990 (Solerno Moreira), Decreto 29.205/1996 (Liceu Mestre Raimundo Cardoso) | Os PDFs vêm do portal de legislação do Município, não do DOM. |
| Lei 7.747/1995 (Escola Bosque) | Publicada no DOM nº 7.926, de 04/01/1995, edição anterior ao acervo digital. O portal de legislação informa que a lei foi **revogada pela Lei 10.143/2025** (DOM nº 15.130, de 10/02/2025). |

### Divergências com o cadastro

- **EM Parque Bolonha (UN-067):** o INEP do cadastro (15161560) é o do "Anexo UP Bolonha", extinto pela Portaria 1.076/2024.
  Confira se a unidade ainda está ativa.
- **EM Castanheiras (UN-150):** há dois decretos de criação, 86.140/2016 (o que o cadastro cita) e 86.316/2016.
- **EM Betinho (UN-117):** o cadastro cita o Decreto 113.719/2025; nos PDFs está o Decreto 112.806/2024, que criou a escola como
  anexa da EMEIF Parque Amazônia.
- **EM Profª Alda Eutrópio de Souza (UN-058)** e **EM Panapaná (UN-168):** o campo "Ato de criação" está vazio no cadastro; os atos
  encontrados são a Portaria 0.629/2010 (antiga EMEIF Tapanã, provável) e a Resolução 21/2014-CME (autorização de funcionamento).

## Todos os atos por unidade

| Unidade | Ato | Relação | Publicação | Associação |
|---|---|---|---|---|
| ANEXO ARIANA LIVIA AMOEDO DE CASTRO DA EM PROFESSORA TEREZINHA SOUZA (UN-071) | Decreto 111.990/2024-PMB, de 13/08/2024 | criação | DOM 15.011, 16/08/2024, p. 2 | confirmada |
| ANEXO PROF SUZETE PERES MAXWELL DA EM ERE (UN-207) | Portaria 3.259/2020-GABS, de 01/12/2020 | criação | DOM 14.141, 16/12/2020, p. 15 | confirmada |
| ANEXO SANTO ANTONIO DA EM DE EDUC DO CAMPO SEBASTIAO DOS S QUARESMA (UN-181) | Portaria 0.974/2019-GABS, de 20/02/2019 | instituição | DOM 13.719, 26/03/2019, p. 6 | confirmada |
| ANEXO SANTO ANTONIO DA EM DE EDUC DO CAMPO SEBASTIAO DOS S QUARESMA (UN-181) | Decreto 93.155/2019-PMB, de 20/02/2019 | criação da escola-sede | DOM 13.726, 04/04/2019, p. 2 | provável |
| ESCOLA MUNICIPAL ALLAN KARDEC (UN-086) | Portaria 540/2007-PMB, de 28/05/2007 | instituição | DOM 10.914, 12/06/2007, p. 3 | confirmada |
| ESCOLA MUNICIPAL ANETE MONTEIRO RODRIGUES (UN-209) | Decreto 111.989/2024-PMB, de 13/08/2024 | criação | DOM 15.011, 16/08/2024, p. 2 | confirmada |
| ESCOLA MUNICIPAL AUGUSTO MEIRA FILHO (UN-019) | Lei 7.183/1981, de 11/11/1981 | denominação | — (sem página do Diário) | confirmada |
| ESCOLA MUNICIPAL AYRTON SENNA (UN-147) | Decreto 82.904/2015-PMB, de 03/06/2015 | criação | DOM 12.825, 11/06/2015, p. 5 | confirmada |
| ESCOLA MUNICIPAL AYRTON SENNA (UN-147) | Decreto 82.905/2015-PMB, de 03/06/2015 | extinção da antecessora | DOM 12.825, 11/06/2015, p. 5 | confirmada |
| ESCOLA MUNICIPAL BACURI (UN-160) | Portaria 564/2007-PMB, de 28/05/2007 | instituição | DOM 10.914, 12/06/2007, p. 5 | confirmada |
| ESCOLA MUNICIPAL BACURI (UN-160) | Resolução 22/2014-CME, de 05/11/2014 | autorização de funcionamento | DOM 12.716, 19/12/2014, p. 6 | confirmada |
| ESCOLA MUNICIPAL BETINHO (UN-117) | Decreto 112.806/2024-PMB, de 13/11/2024 | criação como anexo | DOM 15.073, 14/11/2024, p. 3 | confirmada |
| ESCOLA MUNICIPAL BOSQUE PROF EIDORFE MOREIRA (UN-195) | Lei 7.747/1995, de 02/01/1995 | criação (autorização) | — (sem página do Diário) | confirmada |
| ESCOLA MUNICIPAL CANTO DO UIRAPURU (UN-200) | Decreto 85.303/2016-PMB, de 22/03/2016 | criação | DOM 13.035, 03/05/2016, p. 3 | confirmada |
| ESCOLA MUNICIPAL CASA DA AMIZADE (UN-136) | Portaria 560/2007-PMB, de 28/05/2007 | instituição | DOM 10.914, 12/06/2007, p. 5 | confirmada |
| ESCOLA MUNICIPAL CASA DA PESCA (UN-191) | Portaria 031/2010-GP (Funbosque), de 02/02/2010 | criação | DOM 11.556, 05/02/2010, p. 10 | confirmada |
| ESCOLA MUNICIPAL CASTANHEIRAS (UN-150) | Decreto 86.140/2016-PMB, de 11/07/2016 | criação | DOM 13.390, 27/10/2017, p. 2 | confirmada |
| ESCOLA MUNICIPAL CASTANHEIRAS (UN-150) | Decreto 86.316/2016-PMB, de 05/08/2016 | criação | DOM 13.112, 23/08/2016, p. 2 | confirmada |
| ESCOLA MUNICIPAL CATALINA I (UN-035) | Portaria 547/2007-PMB, de 28/05/2007 | instituição | DOM 10.914, 12/06/2007, p. 4 | confirmada |
| ESCOLA MUNICIPAL CATALINA II (UN-036) | Portaria 548/2007-PMB, de 28/05/2007 | instituição | DOM 10.914, 12/06/2007, p. 4 | confirmada |
| ESCOLA MUNICIPAL CATALINA III (UN-037) | Portaria 549/2007-PMB, de 28/05/2007 | instituição | DOM 10.914, 12/06/2007, p. 4 | confirmada |
| ESCOLA MUNICIPAL COHAB III (UN-131) | Portaria 561/2007-PMB, de 28/05/2007 | instituição | DOM 10.914, 12/06/2007, p. 5 | confirmada |
| ESCOLA MUNICIPAL COTIJUBA (UN-189) | Decreto 85.922/2016-PMB, de 15/06/2016 | criação | DOM 13.069, 22/06/2016, p. 2 | confirmada |
| ESCOLA MUNICIPAL DE EDUCACAO DO CAMPO MARIA CLEMILDES (UN-157) | Decreto 86.757/2016-PMB, de 04/11/2016 | criação | DOM 13.161, 08/11/2016, p. 2 | confirmada |
| ESCOLA MUNICIPAL DE EDUCACAO DO CAMPO MARIA CLEMILDES (UN-157) | Portaria 6065/2018-GABS/SEMEC, de 25/04/2018 | recebe o acervo | DOM 13.661, 27/12/2018, p. 14–15 | confirmada |
| ESCOLA MUNICIPAL DE EDUCACAO DO CAMPO MARIA MADALENA TRAVASSOS (UN-158) | Decreto 68.679/2011-PMB, de 21/12/2011 | criação | DOM 12.005, 04/01/2012, p. 3 | confirmada |
| ESCOLA MUNICIPAL DE EDUCACAO DO CAMPO MARIA MADALENA TRAVASSOS (UN-158) | Decreto 95.304/2020-PMB, de 08/01/2020 | alteração de nome | DOM 13.912, 14/01/2020, p. 2 | confirmada |
| ESCOLA MUNICIPAL DE EDUCACAO DO CAMPO MILTON MONTE (UN-182) | Portaria 1.731/2014-GABS, de 08/07/2014 | vinculação de unidades | DOM 12.668, 08/10/2014, p. 6 | confirmada |
| ESCOLA MUNICIPAL DE EDUCACAO DO CAMPO MILTON MONTE (UN-182) | Decreto 94.448/2019-PMB, de 27/08/2019 | alteração de nome | DOM 13.826, 05/09/2019, p. 5 | confirmada |
| ESCOLA MUNICIPAL DE EDUCACAO DO CAMPO SEBASTIAO DOS SANTOS QUARESMA (UN-184) | Portaria 0.973/2019-GABS/SEMEC, de 20/02/2019 | extinção da antecessora | DOM 13.719, 26/03/2019, p. 6 | provável |
| ESCOLA MUNICIPAL DE EDUCACAO DO CAMPO SEBASTIAO DOS SANTOS QUARESMA (UN-184) | Decreto 93.155/2019-PMB, de 20/02/2019 | criação | DOM 13.726, 04/04/2019, p. 2 | confirmada |
| ESCOLA MUNICIPAL DE EDUCACAO QUILOMBOLA DE SUCURIJUQUARA ARLINDA GOMES (UN-174) | Decreto 95.305/2020-PMB, de 08/01/2020 | antecessora | DOM 13.912, 14/01/2020, p. 2 | confirmada |
| ESCOLA MUNICIPAL DE EDUCACAO QUILOMBOLA DE SUCURIJUQUARA ARLINDA GOMES (UN-174) | Portaria 582/2024-GABS/SEMEC, de 21/03/2024 | extinção da antecessora | DOM 14.916, 25/03/2024, p. 6 | confirmada |
| ESCOLA MUNICIPAL DE EDUCACAO QUILOMBOLA DE SUCURIJUQUARA ARLINDA GOMES (UN-174) | Portaria 1.077/2024-GABS/SEMEC, de 22/05/2024 | extinção da antecessora | DOM 14.956, 23/05/2024, p. 11 | confirmada |
| ESCOLA MUNICIPAL DE EDUCACAO QUILOMBOLA DE SUCURIJUQUARA ARLINDA GOMES (UN-174) | Decreto 111.392/2024-PMB, de 26/06/2024 | criação | DOM 14.981, 01/07/2024, p. 3 | confirmada |
| ESCOLA MUNICIPAL DIREITO DE SER CRIANCA (UN-097) | Decreto 85.304/2016-PMB, de 22/03/2016 | criação | DOM 13.035, 03/05/2016, p. 3 | confirmada |
| ESCOLA MUNICIPAL DUAS IRMAS BIANCA E ADRIELY (UN-043) | Decreto 73.552/2013-PMB, de 15/01/2013 | criação | DOM 12.255, 18/01/2013, p. 11–12 | confirmada |
| ESCOLA MUNICIPAL DUAS IRMAS BIANCA E ADRIELY (UN-043) | Decreto 81.011/2014-PMB, de 15/10/2014 | retificação | DOM 12.676, 21/10/2014, p. 2 | confirmada |
| ESCOLA MUNICIPAL ENCANTO DO SABER (UN-090) | Portaria 2.064/2015-GABS, de 21/07/2015 | instituição | DOM 13.018, 06/04/2016, p. 4–5 | confirmada |
| ESCOLA MUNICIPAL ERE (UN-196) | Portaria 552/2007-PMB, de 28/05/2007 | instituição | DOM 10.914, 12/06/2007, p. 4 | confirmada |
| ESCOLA MUNICIPAL ERE (UN-196) | Decreto 94.460/2019-PMB | alteração de nome | DOM 13.826, 05/09/2019, p. 5 | confirmada |
| ESCOLA MUNICIPAL GENESIS (UN-132) | Portaria 544/2007-PMB, de 28/05/2007 | antecessora | DOM 10.914, 12/06/2007, p. 3 | provável |
| ESCOLA MUNICIPAL GENESIS (UN-132) | Decreto 82.887/2015-PMB, de 02/06/2015 | criação | DOM 12.825, 11/06/2015, p. 4 | confirmada |
| ESCOLA MUNICIPAL GENESIS (UN-132) | Decreto 82.888/2015-PMB, de 02/06/2015 | extinção da antecessora | DOM 12.825, 11/06/2015, p. 5 | provável |
| ESCOLA MUNICIPAL IZA CUNHA (UN-197) | Portaria 1.019/2007-PMB, de 12/09/2007 | instituição | DOM 10.985, 21/09/2007, p. 7 | confirmada |
| ESCOLA MUNICIPAL JARDIM NOVA VIDA (UN-064) | Decreto 85.697/2016-PMB, de 09/05/2016 | criação | DOM 13.041, 11/05/2016, p. 5–6 | confirmada |
| ESCOLA MUNICIPAL JESUS MARIA E JOSE (UN-076) | Portaria 557/2007-PMB, de 28/05/2007 | instituição | DOM 10.914, 12/06/2007, p. 5 | confirmada |
| ESCOLA MUNICIPAL LICEU MESTRE RAIMUNDO CARDOSO (UN-125) | Decreto 29.205/1996-PMB, de 13/09/1996 | criação | — (sem página do Diário) | confirmada |
| ESCOLA MUNICIPAL MARACAJA (UN-175) | Portaria 562/2007-PMB, de 28/05/2007 | instituição | DOM 10.914, 12/06/2007, p. 5 | confirmada |
| ESCOLA MUNICIPAL MARIA DA CONCEICAO DE SOUZA (UN-065) | Portaria 1.076/2024-GABS/SEMEC, de 22/05/2024 | recebe o acervo | DOM 14.956, 23/05/2024, p. 11 | confirmada |
| ESCOLA MUNICIPAL MARIA DA CONCEICAO DE SOUZA (UN-065) | Decreto 111.987/2024-PMB, de 13/08/2024 | criação | DOM 15.018, 27/08/2024, p. 2 | confirmada |
| ESCOLA MUNICIPAL MARIA LUCIA OLIVEIRA MONTEIRO (UN-151) | Decreto 91.069/2018-PMB, de 24/04/2018 | criação | DOM 13.512, 08/05/2018, p. 2 | confirmada |
| ESCOLA MUNICIPAL MONTE ALEGRE (UN-109) | Portaria 539/2007-PMB, de 28/05/2007 | instituição | DOM 10.914, 12/06/2007, p. 3 | confirmada |
| ESCOLA MUNICIPAL MOSQUEIRO (UN-172) | Portaria 0.660/2016-GABS, de 16/03/2016 | instituição | DOM 13.018, 06/04/2016, p. 4 | confirmada |
| ESCOLA MUNICIPAL MOSQUEIRO (UN-172) | Decreto 85.350/2016-PMB, de 01/04/2016 | criação | DOM 13.035, 03/05/2016, p. 3 | confirmada |
| ESCOLA MUNICIPAL NOSSO LAR (UN-057) | Decreto 81.565/2014-PMB, de 16/12/2014 | criação | DOM 12.718, 23/12/2014, p. 2 | confirmada |
| ESCOLA MUNICIPAL NOVA ALIANCA (UN-044) | Decreto 80.450/2014-PMB, de 11/08/2014 | criação | DOM 12.719, 29/12/2014, p. 2 | confirmada |
| ESCOLA MUNICIPAL PADRE BRUNO SECHI (UN-030) | Portaria 583/2024-GABS/SEMEC, de 21/03/2024 | extinção da antecessora | DOM 14.916, 25/03/2024, p. 6 | confirmada |
| ESCOLA MUNICIPAL PADRE BRUNO SECHI (UN-030) | Decreto 113.110/2024-PMB, de 23/12/2024 | criação | DOM 15.099, 26/12/2024, p. 3 | confirmada |
| ESCOLA MUNICIPAL PANAPANA (UN-168) | Resolução 21/2014-CME, de 05/11/2014 | autorização de funcionamento | DOM 12.716, 19/12/2014, p. 6 | confirmada |
| ESCOLA MUNICIPAL PARQUE BOLONHA (UN-067) | Decreto 72.135/2012-PMB, de 08/11/2012 | criação | DOM 12.212, 12/11/2012, p. 2 | confirmada |
| ESCOLA MUNICIPAL PARQUE BOLONHA (UN-067) | Portaria 1.076/2024-GABS/SEMEC, de 22/05/2024 | extinção | DOM 14.956, 23/05/2024, p. 11 | provável |
| ESCOLA MUNICIPAL PAULO ALMEIDA BRASIL (UN-084) | Decreto 86.315/2016-PMB, de 05/08/2016 | criação | DOM 13.112, 23/08/2016, p. 2 | confirmada |
| ESCOLA MUNICIPAL PERPETUO SOCORRO (UN-217) | Portaria 554/2007-PMB, de 28/05/2007 | instituição | DOM 10.914, 12/06/2007, p. 4 | confirmada |
| ESCOLA MUNICIPAL PRATINHA (UN-045) | Portaria 545/2007-PMB, de 28/05/2007 | antecessora | DOM 10.914, 12/06/2007, p. 3 | a conferir |
| ESCOLA MUNICIPAL PRATINHA (UN-045) | Decreto 91.275/2018-PMB, de 21/05/2018 | criação | DOM 13.526, 28/05/2018, p. 3 | confirmada |
| ESCOLA MUNICIPAL PRATINHA (UN-045) | Decreto 94.449/2019-PMB, de 10/09/2019 | criação | DOM 13.831, 12/09/2019, p. 2 | a conferir |
| ESCOLA MUNICIPAL PRATINHA II (UN-046) | Portaria 545/2007-PMB, de 28/05/2007 | antecessora | DOM 10.914, 12/06/2007, p. 3 | a conferir |
| ESCOLA MUNICIPAL PRATINHA II (UN-046) | Decreto 94.449/2019-PMB, de 10/09/2019 | criação | DOM 13.831, 12/09/2019, p. 2 | a conferir |
| ESCOLA MUNICIPAL PROFA VANDA CELIA FERREIRA DE SOUZA (UN-139) | Decreto 94.241/2019-PMB, de 16/07/2019 | criação | DOM 13.798, 25/07/2019, p. 2 | confirmada |
| ESCOLA MUNICIPAL PROFESSOR JAIME DA COSTA TEIXEIRA (UN-152) | Decreto 95.513/2020-PMB, de 03/02/2020 | criação | DOM 13.932, 11/02/2020, p. 2 | confirmada |
| ESCOLA MUNICIPAL PROFESSOR LUIZ CARLOS ACACIO BARBOSA (UN-101) | Decreto 96.044/2020-PMB, de 31/03/2020 | criação | DOM 13.970, 08/04/2020, p. 3 | confirmada |
| ESCOLA MUNICIPAL PROFESSOR PEDRO DEMO (UN-177) | Decreto 68.678/2011-PMB, de 21/12/2011 | criação | DOM 12.005, 04/01/2012, p. 3 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA ALANA DE SOUZA BARBOZA (UN-031) | Portaria 1.313/2008-GABS, de 08/10/2008 | instituição | DOM 11.241, 15/10/2008, p. 1 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA ALDA EUTROPIO DE SOUZA (UN-058) | Portaria 0.629/2010-GABS, de 28/06/2010 | criação | DOM 11.650, 30/06/2010, p. 3 | provável |
| ESCOLA MUNICIPAL PROFESSORA ALDAIR NERI LOPES (UN-059) | Decreto 95.487/2020-PMB, de 03/02/2020 | criação | DOM 13.932, 11/02/2020, p. 2 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA ANGELICA DO CARMO SANTOS PAIVA (UN-021) | Portaria 550/2007-PMB, de 28/05/2007 | antecessora | DOM 10.914, 12/06/2007, p. 4 | provável |
| ESCOLA MUNICIPAL PROFESSORA ANGELICA DO CARMO SANTOS PAIVA (UN-021) | Decreto 95.488/2020-PMB, de 03/02/2020 | criação | DOM 13.932, 11/02/2020, p. 2 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA AURORA GUIMARES VIEIRA (UN-081) | Portaria 556/2007-PMB, de 28/05/2007 | antecessora | DOM 10.914, 12/06/2007, p. 5 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA AURORA GUIMARES VIEIRA (UN-081) | Decreto 96.723/2020-PMB, de 20/07/2020 | criação | DOM 14.044, 27/07/2020, p. 2 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA CIRIA DE NAZARE TULOSA DOS SANTOS (UN-140) | Decreto 95.345/2020-PMB, de 09/01/2020 | criação | DOM 13.912, 14/01/2020, p. 2 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA CLEONICE OLIVEIRA CONCEICAO (UN-048) | Portaria 551/2007-PMB, de 28/05/2007 | antecessora | DOM 10.914, 12/06/2007, p. 4 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA CLEONICE OLIVEIRA CONCEICAO (UN-048) | Decreto 89.867/2017-PMB, de 02/10/2017 | criação | DOM 13.378, 06/10/2017, p. 2 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA CLEONICE OLIVEIRA CONCEICAO (UN-048) | Portaria 6064/2018-GABS/SEMEC | recebe o acervo | DOM 13.742, 30/04/2019, p. 11 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA ELVIRA SACRAMENTO DE QUADROS (UN-060) | Decreto 87.368/2017-PMB, de 06/02/2017 | criação | DOM 13.390, 27/10/2017, p. 2 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA GILVANIA MARCIA BARROS DA SILVA (UN-022) | Decreto 89.868/2017-PMB, de 02/10/2017 | criação | DOM 13.378, 06/10/2017, p. 3 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA JOANA DARC GUIMARAES DE OLIVEIRA (UN-102) | Decreto 111.988/2024-PMB, de 13/08/2024 | criação | DOM 15.011, 16/08/2024, p. 2 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA JOANA DARC GUIMARAES DE OLIVEIRA (UN-102) | Decreto 112.888/2024-PMB, de 22/11/2024 | retificação | DOM 15.079, 26/11/2024, p. 2 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA LAIS FONTOURA ADERNE (UN-128) | Portaria 1.314/2008-GABS, de 08/10/2008 | instituição | DOM 11.241, 15/10/2008, p. 1 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA LUCIA SOARES CASTRO (UN-008) | Portaria 536/2007-PMB, de 28/05/2007 | antecessora | DOM 10.914, 12/06/2007, p. 2 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA LUCIA SOARES CASTRO (UN-008) | Decreto 96.504/2020-PMB, de 16/06/2020 | criação | DOM 14.051, 05/08/2020, p. 4 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA LUZMARINA DE MELO MUNIZ (UN-141) | Decreto 94.243/2019-PMB, de 16/07/2019 | criação | DOM 13.798, 25/07/2019, p. 2 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA MARIA AUXILIADORA MARTINS GONCALVES (UN-001) | Portaria 566/2007-PMB, de 28/05/2007 | antecessora | DOM 10.914, 12/06/2007, p. 6 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA MARIA AUXILIADORA MARTINS GONCALVES (UN-001) | Decreto 96.781/2020-PMB, de 21/07/2020 | criação | DOM 14.044, 27/07/2020, p. 2 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA MARIA DE BELEM CAVALCANTE LESSA (UN-142) | Decreto 95.195/2019-PMB, de 27/12/2019 | criação | DOM 13.907, 07/01/2020, p. 4 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA PERPETUO SOCORRO JESUS FIGUEIREDO (UN-061) | Decreto 97.641/2020-PMB, de 26/10/2020 | criação | — (sem página do Diário) | confirmada |
| ESCOLA MUNICIPAL PROFESSORA RAIMUNDA LUCIA GUERREIRO (UN-009) | Decreto 96.325/2020-PMB, de 19/05/2020 | criação | DOM 14.022, 25/06/2020, p. 3 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA RAIMUNDA LUCIA GUERREIRO (UN-009) | Decreto 96.503/2020-PMB, de 16/06/2020 | retificação | DOM 14.051, 05/08/2020, p. 4 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA RENATA SALES PENA (UN-149) | Decreto 86.401/2016-PMB, de 18/08/2016 | criação | DOM 13.145, 11/10/2016, p. 2 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA RENATA SALES PENA (UN-149) | Decreto 86.769/2016-PMB, de 09/11/2016 | retificação | DOM 13.212, 25/01/2017, p. 2 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA RENILDES NUNES BATISTA (UN-193) | Decreto 94.463/2019-PMB, de 10/09/2019 | criação | DOM 13.831, 12/09/2019, p. 2 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA RITA NERY (UN-154) | Portaria 1.221/2009-GABS/SEMEC, de 04/12/2009 | criação | DOM **?**, 15/12/2009, p. 9 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA RITA NERY (UN-154) | Portaria 0.436/2010-GABS, de 17/05/2010 | retificação | DOM 11.628, 26/05/2010, p. 5 | confirmada |
| ESCOLA MUNICIPAL PROFESSORA ROSENIL CORDEIRO DA SILVA (UN-110) | Portaria 543/2007-PMB, de 28/05/2007 | antecessora | DOM 10.914, 12/06/2007, p. 3 | provável |
| ESCOLA MUNICIPAL PROFESSORA ROSENIL CORDEIRO DA SILVA (UN-110) | Decreto 90.970/2018-PMB, de 04/04/2018 | criação | DOM 13.496, 12/04/2018, p. 2 | confirmada |
| ESCOLA MUNICIPAL PROVIDENCIA (UN-079) | Portaria 559/2007-PMB, de 28/05/2007 | instituição | DOM 10.914, 12/06/2007, p. 5 | confirmada |
| ESCOLA MUNICIPAL REVOAR DAS ANDORINHAS (UN-201) | Decreto 85.301/2016-PMB, de 22/03/2016 | criação | DOM 13.035, 03/05/2016, p. 2 | confirmada |
| ESCOLA MUNICIPAL ROSEMARY JORGE (UN-074) | Portaria 555/2007-PMB, de 28/05/2007 | instituição | DOM 10.914, 12/06/2007, p. 4 | confirmada |
| ESCOLA MUNICIPAL ROTARY CLUB (UN-164) | Portaria 563/2007-PMB, de 28/05/2007 | instituição | DOM 10.914, 12/06/2007, p. 5 | confirmada |
| ESCOLA MUNICIPAL SABINO BARRETO (UN-124) | Decreto 81.566/2014-PMB, de 16/12/2014 | criação | DOM 12.718, 23/12/2014, p. 2 | confirmada |
| ESCOLA MUNICIPAL SACRAMENTA (UN-204) | Portaria 553/2007-PMB, de 28/05/2007 | instituição | DOM 10.914, 12/06/2007, p. 4 | confirmada |
| ESCOLA MUNICIPAL SANTA ROSA (UN-103) | Portaria 542/2007-PMB, de 28/05/2007 | instituição | DOM 10.914, 12/06/2007, p. 3 | confirmada |
| ESCOLA MUNICIPAL SANTANA DO AURA (UN-070) | Decreto 82.593/2015-PMB, de 20/04/2015 | criação (transformação) | DOM 12.797, 30/04/2015, p. 3 | confirmada |
| ESCOLA MUNICIPAL SAO FRANCISCO (UN-173) | Decreto 85.302/2016-PMB, de 22/03/2016 | criação | DOM 13.035, 03/05/2016, p. 3 | confirmada |
| ESCOLA MUNICIPAL SAO GASPAR (UN-032) | Portaria 1.030/2014-GABS, de 23/04/2014 | instituição | DOM 12.556, 24/04/2014, p. 2 | confirmada |
| ESCOLA MUNICIPAL SAO JOAO PAULO II (UN-047) | Portaria 546/2007-PMB, de 28/05/2007 | antecessora | DOM 10.914, 12/06/2007, p. 3 | confirmada |
| ESCOLA MUNICIPAL SAO JOAO PAULO II (UN-047) | Decreto 111.991/2024-PMB, de 13/08/2024 | criação | DOM 15.011, 16/08/2024, p. 2–3 | confirmada |
| ESCOLA MUNICIPAL SOLERNO MOREIRA (UN-121) | Lei 7.481/1990, de 25/04/1990 | denominação | — (sem página do Diário) | confirmada |
| ESCOLA MUNICIPAL TERRA FIRME (UN-122) | Portaria 541/2007-PMB, de 28/05/2007 | instituição | DOM 10.914, 12/06/2007, p. 3 | confirmada |
| ESCOLA MUNICIPAL VENUZINA MARINHO DE SOUZA (UN-092) | Portaria 538/2007-PMB, de 28/05/2007 | antecessora | DOM 10.914, 12/06/2007, p. 2–3 | provável |
| ESCOLA MUNICIPAL VENUZINA MARINHO DE SOUZA (UN-092) | Decreto 95.218/2019-PMB, de 27/12/2019 | criação | DOM 13.907, 07/01/2020, p. 4 | confirmada |
| ESCOLA MUNICIPAL VERDEJANTE (UN-068) | Portaria 0157/2015-GABS, de 23/02/2015 | instituição | DOM 12.792, 23/04/2015, p. 9 | confirmada |
| ESCOLA MUNICIPAL WILSON BAHIA DE SOUZA (UN-077) | Portaria 558/2007-PMB, de 28/05/2007 | instituição | DOM 10.914, 12/06/2007, p. 5 | confirmada |

## Como acrescentar ou corrigir um ato

Edite [`src/data/atos-diario.json`](../../src/data/atos-diario.json): cada ato tem `tipo`, `numero`, `data`, `ementa`, a
`publicacao` (`edicao`, `data`, `pagina`, `pagina_final`) e a lista de `unidades` (`id` e `inep` do cadastro, `relacao`,
`confianca` e, se não for `alta`, uma `nota` explicando). Rode `npm test` para conferir e publique.
