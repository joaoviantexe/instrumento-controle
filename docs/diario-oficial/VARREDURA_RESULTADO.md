# Resultado da varredura do Diário Oficial

Resultado da leitura das edições do painel do Diário Oficial do Município de Belém (aba **Dados e planilhas → Diário Oficial**), feita em 13/10/2026, e da associação dos atos encontrados às unidades do cadastro. O site continua **sem guardar PDFs**: cada ato abre a edição direto no Diário, na página do ato. Como a varredura funciona: [DIARIO_OFICIAL.md](DIARIO_OFICIAL.md).

## Números

| | |
|---|---|
| Edições no painel | 5.149 |
| Edições lidas | 5.139 |
| Atos sobre escolas separados pela varredura | 1.520 |
| Atos lidos para associação | 1.187 (os que citam o nome de uma unidade, mais 45 sem nome mas com termo de criação ou extinção) |
| Atos novos no site | 42 (21 decretos, 20 portarias, 1 lei) |
| Vínculos novos | 84: 67 confirmados no texto, 12 prováveis, 5 a conferir |
| Atos do Diário no site (antes → agora) | 119 → 161 |
| Unidades com ao menos um ato do Diário | 88 → 140 de 217 |
| Atos de criação citados no cadastro e associados à unidade | 102 de 107 (os 5 restantes entraram como "provável": anexos do Decreto 113.722/2025 e 113.721/2025) |

## Como foi feito

1. **Varredura** (no navegador, sem IA): texto de cada edição, separado em atos; ficam os que citam escola e um termo de criação, extinção, nome ou funcionamento.
2. **Candidatas**: para cada ato, as unidades sugeridas por nome atual, nomes antigos e INEP.
3. **Leitura** por 13 agentes, cada um com um trecho do ato e o dicionário das 217 unidades: decide se o ato é relevante, a unidade, a relação e a confiança.
4. **Verificação independente** de todos os atos novos por 3 verificadores céticos, que tentaram derrubar cada associação com o texto do ato: 96 confirmadas, 1 recusada (Portaria 3.395/2016 e a UN-047: era outra unidade) e 7 inconclusivas, que ficaram rebaixadas.
5. **Regras de segurança**: nada do que você já havia revisado é sobrescrito; autorizações e credenciamentos do CME não entram aqui (a seção "Resoluções do CME" traz o PDF certo de cada uma); trechos mal separados (continuações de portarias rotuladas como decreto) foram corrigidos.

## Limites

- **Edições antigas (cerca de 2005–2009):** o corpo dos atos é uma imagem dentro do PDF e só os títulos e as assinaturas têm texto. A varredura não faz OCR, então não acha o conteúdo dessas edições (por exemplo, as 31 Portarias de 2007 que instituíram as UEIs já estavam no site porque vieram dos PDFs que você enviou). Se houver criação de unidade nessas edições, ela precisa de OCR.
- **Edições com erro (9):** 18357 (12/03/2026, número fora da sequência) e as de 2009: 11482, 11474, 11465, 11460, 11454, 11436, 11426, 11417. O site da Prefeitura devolveu erro 502. Clique em **Continuar** na aba Diário Oficial para tentar de novo.
- **Edição sem texto (1):** a de número 90001 (data 01/01/1900), que parece um registro de teste do painel.
- **Decreto 113.716/2025** (nomenclatura das escolas): o trecho lido tinha só parte do anexo (30 de pelo menos 79 itens). As outras unidades renomeadas por ele ainda não estão ligadas.
- **Decreto 97.641/2020** (Perpétuo Socorro) segue sem edição: não apareceu nas edições de outubro e novembro de 2020 lidas.

## Resolvido pela varredura

- **Portaria 1.221/2009 (EMEIF Prof.ª Rita Nery Vanetta):** a edição é a **11.523**, de 15/12/2009 (p. 9–11). O link já funciona.
- **Vínculos novos em atos que você já tinha:** 5 (por exemplo, a Portaria 3.259/2020 também liga a EMEI Erê, sede da escola anexa).

## O que conferir

Todos aparecem na aba **Dados e planilhas → Conferência de atos**, onde você confirma ou recusa. Os de confiança "provável" e "a conferir" dos atos novos:

| Unidade | Ato | Situação | Motivo |
|---|---|---|---|
| Escola Municipal Deputado Joao Carlos Batista (UN-026) | Portaria 107/2010-GABS/SEMEC — DOM 11.566, 24/02/2010, p. 8 | provável | A UP extinta não consta no cadastro; a escola-sede "João Carlos Batista" é associada a UN-026 (EM Deputado João Carlos Batista, Cabanagem) por nome, sem endereço no ato. |
| Escola Municipal Alana De Souza Barbosa I (UN-027) | Portaria 3.026/2014-GABS — DOM 12.722, 06/01/2015, p. 6 | a conferir | Ver nota de UN-031. Verificação inconclusiva: Trecho cortado sem endereço; UP 'Allana Barboza' não pode ser ligada a 027 (criada em 2025) com segurança. |
| Escola Municipal Alana De Souza Barbosa Ii (UN-028) | Portaria 3.026/2014-GABS — DOM 12.722, 06/01/2015, p. 6 | a conferir | Ver nota de UN-031. Verificação inconclusiva: Trecho cortado sem endereço; ligação com a II criada em 2025 é só suposição pelo nome. |
| Escola Municipal Professora Alana De Souza Barboza (UN-031) | Portaria 3.026/2014-GABS — DOM 12.722, 06/01/2015, p. 6 | a conferir | Não dá para saber se é a atual Profa. Alana de Souza Barboza (UN-031) ou as Alana de Souza Barboza I/II (UN-027/028), criadas em 2025. Verificação inconclusiva: Trecho cortado sem endereço; escola existente desde 2008 com nome parecido, mas nada mostra qual unidade a UP é. |
| Escola Municipal Jardim Nova Vida (UN-064) | Portaria 0.106/2015-GABS — DOM 12.771, 20/03/2015, p. 5–6 | provável | Unidade Pedagógica Jardim Nova Vida seria a antecessora da EM Jardim Nova Vida (criada pelo Decreto 85.697/2016); mesmo nome e bairro, mas ato não menciona a escola atual. |
| Escola Municipal Professor Pedro Demo (UN-177) | Portaria 0.697/2015-GABS — DOM 12.792, 23/04/2015, p. 9–10 | provável | Ato fala em Avenida Paulo Costa, 9, Água Boa, DAOUT; cadastro de UN-177 está em Água Boa (Outeiro), criação por Decreto 68.678/2011. Unidade pedagógica de mesmo nome; conferir se é a mesma unidade. Verificação inconclusiva: Mesmo nome e bairro, mas a escola foi criada em 2011 e o endereço do ato (Av. Paulo Costa 9) difere do cadastro; a UP instituída em 2015 pode ser outra unidade, e 'instituição' não vale para a escola. |
| Escola Municipal Maria Da Conceicao De Souza (UN-065) | Portaria 3.063/2014-GABS — DOM 13.052, 30/05/2016, p. 5–6 | a conferir | UN-065 tem Aurá como nome antigo (criação 111.987/2024, Rua Oito de Março, Conj. Nova Vida, Águas Lindas); ato dá Conjunto Verdejante IV, mesmo bairro. Inferência por nome antigo e bairro. Verificação inconclusiva: Nome antigo 'Aurá' e bairro coincidem, mas o endereço do ato (Conj. Verdejante IV, Qd 04, Rua 04, nº 16) difere do cadastro (Rua Oito de Março, Conj. Nova Vida) e não há prova de que a UEI Aurá de 2014 seja a antecessora de UN-065. |
| Centro Catequetico De Promocao Humana Santa Izabel Da Hungria (UN-095) | Portaria 3.234/2020-GABS — DOM 14.137, 10/12/2020, p. 7 | provável | Nome (Isabel/Izabel) e endereço (Passagem Guerra Passos, 442) coincidem com o cadastro, que porém registra a unidade como OSC (Centro Catequético de Promoção Humana Santa Izabel da Hungria), não como anexo da Rosenil. |
| Escola Municipal Professora Terezinha Souza (UN-073) | Portaria 707/2024-GABS/SEMEC — DOM 14.932, 18/04/2024, p. 10–11 | provável | Escola-sede à qual a anexa nova é vinculada; o ato não trata dela diretamente. |
| Escola Municipal Professora Rosenil Cordeiro Da Silva (UN-110) | Portaria 715/2024-GABS/SEMEC — DOM 14.934, 22/04/2024, p. 7–8 | provável | Escola à qual a nova anexa seria vinculada; vínculo depois desfeito pela retificação. |
| Centro Catequetico De Promocao Humana Santa Izabel Da Hungria (UN-095) | Portaria 2.800/2024-GABS/SEMEC — DOM 15.052, 15/10/2024, p. 8 | provável | O ato troca 'Centro Catequético' por 'Anexo Santa Izabel da Hungria'; associação por nome (ver nota na Portaria 715/2024). |
| Anexo Nsra Dos Navegantes Varzea Da Em De Educ Do Campo Sao Jose (UN-180) | Decreto 113.721/2025-PMB — DOM 15.216, 24/06/2025, p. 7 | provável | O cadastro cita este ato como o de criação da unidade; o trecho lido do Diário não a nomeia (lista só a escola-sede). Confira no PDF. |
| Anexo Jamaci Da Em Faveira (UN-178) | Decreto 113.722/2025-PMB — DOM 15.216, 24/06/2025, p. 7 | provável | O cadastro cita este ato como o de criação da unidade; o trecho lido do Diário não a nomeia (lista só a escola-sede). Confira no PDF. |
| Anexo Jutuba Da Em Faveira (UN-179) | Decreto 113.722/2025-PMB — DOM 15.216, 24/06/2025, p. 7 | provável | O cadastro cita este ato como o de criação da unidade; o trecho lido do Diário não a nomeia (lista só a escola-sede). Confira no PDF. |
| Anexo Flexeira Da Em Faveira (UN-187) | Decreto 113.722/2025-PMB — DOM 15.216, 24/06/2025, p. 7 | provável | O cadastro cita este ato como o de criação da unidade; o trecho lido do Diário não a nomeia (lista só a escola-sede). Confira no PDF. |
| Anexo Seringal Da Em Faveira (UN-188) | Decreto 113.722/2025-PMB — DOM 15.216, 24/06/2025, p. 7 | provável | O cadastro cita este ato como o de criação da unidade; o trecho lido do Diário não a nomeia (lista só a escola-sede). Confira no PDF. |
| Escola Municipal Bosque Prof Eidorfe Moreira (UN-195) | Portaria 2.037/2025-GABS/SEMEC — DOM 15.269, 08/09/2025, p. 7–8 | a conferir | Trecho do ato traz só o preâmbulo; o objeto (estrutura/funcionamento da Escola Bosque Prof. Eidorfe Moreira) vem da citação na Portaria 2.038/2025. Conferir texto integral. Verificação inconclusiva: Trecho contém só o preâmbulo; o objeto (Escola Bosque) não aparece no texto, e a relação "outro" depende da Portaria 2.038 externa. |

Divergências de edição ou página entre os atos já revisados e a varredura (o revisado foi mantido):

- `portaria-1030-2014`: revisado DOM 12556, p. 2; varredura DOM 12577, p. 7. Provável republicação; confira qual abre o ato correto.
- `decreto-86757-2016`: revisado DOM 13161, p. 2; varredura DOM 13161, p. 14. Provável republicação; confira qual abre o ato correto.

Associações descartadas na verificação:

- Portaria 3.395/2016-GABS → UN-047: Unidade Pedagógica João Paulo II fica na Av. João Paulo II 462, Marco (DABEL); UN-047 é a EM São João Paulo II em Pratinha/Icoaraci (DABEN), só o nome é parecido.
