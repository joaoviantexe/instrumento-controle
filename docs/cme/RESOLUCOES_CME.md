# Resoluções do CME por unidade

Cada unidade tem, na sua página, a seção **Resoluções do CME**: as resoluções do Conselho Municipal de Educação de Belém que autorizam, renovam, prorrogam ou credenciam a unidade, com o botão **Abrir PDF**. O PDF abre direto no site do CME ([cmebelem.com.br/resolucoes](https://www.cmebelem.com.br/resolucoes)); nada é copiado para o armazenamento do sistema.

## Conferindo no site

Em **Dados e planilhas → Conferência de atos** ficam reunidos os pendentes:

- **Resoluções do CME e atos do Diário a conferir:** cada associação "Provável — confira" ou "A conferir", com o PDF para abrir. **Confirmar** a troca por "Conferido pela CDE" na página da unidade; **Recusar** (com motivo opcional) a tira de lá. O filtro "Já conferidos" permite **Desfazer**.
- **Unidades sem resolução do CME** e **atos do Diário sem link** para a edição, com busca por unidade.
- **PDFs enviados que já estão no Diário ou no CME:** PDFs de "Decreto", "Ato de criação", "Ato de autorização" e resoluções do CME cuja unidade já tem o ato como link **confirmado** (e, no Diário, com número de edição). Você abre o PDF e o link, marca os que são o mesmo documento e exclui; nada vem marcado e a exclusão pede confirmação. O ato continua acessível pelo link.

Ao confirmar uma associação, a explicação automática da dúvida ("Ligação por nome antigo…") deixa de aparecer na página da unidade. O botão **Observação** permite escrever um texto próprio, que passa a aparecer no lugar dela.

A pendência "Ato de autorização: sem PDF anexado nem resolução do CME" considera cumprida a unidade que tem o PDF anexado **ou** uma resolução do CME associada, então apagar o PDF duplicado não cria pendência nova.

As decisões ficam na tabela `conferencias` do Supabase (só a decisão, com o e-mail de quem conferiu e a data; os atos e os PDFs continuam no código e no site do CME). Quem tem acesso ao sistema pode conferir; não há um papel separado de administrador. **Antes de usar, execute de novo o `supabase/schema.sql` no SQL Editor** para criar a tabela; sem ela o painel avisa e as associações aparecem como no arquivo de dados.

## Resumo

- **568 resoluções** do CME ligadas a **193 das 217 unidades** (641 vínculos): 506 confirmados no texto, 123 prováveis e 12 a conferir.
- A lista completa do CME tem 867 resoluções (1995–2026). As demais são normas gerais, calendários, validação de estudos de alunos e atos de escolas que não estão no cadastro (particulares, estaduais, entidades sem unidade).
- Os 188 atos de autorização que o próprio cadastro cita (campo "Ato de autorização", ex.: `072/2018 - CME`) foram ligados pelo número e ano, sem interpretação: todos existem no site do CME e estão associados.
- O restante veio da leitura da descrição de cada resolução (nome da escola, nomes antigos, entidade mantenedora, anexos). Dos 159 atos do cadastro que têm descrição própria da escola, 158 (99%) foram reencontrados só pela leitura, o que dá uma medida da precisão. A única falha foi o anexo Ariana Lívia (Res. 22/2023), que o ato nomeia só pela escola-sede; a Res. 22/2025 é geral e está descrita abaixo.

## Como os dados foram obtidos

O site do CME guarda as resoluções no CMS Prismic (`https://cme-website.prismic.io/api/v2`, documento `todas_as_resolucoes`), com ano, título, descrição e o PDF. A API é pública e não precisa do Worker nem de login. Para atualizar, repita a leitura e inclua as resoluções novas em `src/data/resolucoes-cme.json` (campo `unidades`: `id`, `inep`, `relacao`, `confianca`, `nota`).

## O que conferir

### Resolução geral 22/2025

A Resolução nº 22/2025 concede **1 ano de prazo para regularizar as escolas novas** (antigos anexos) e as que mudaram de nome. O cadastro a cita como ato de autorização de 29 unidades; ela aparece em cada uma como "prazo de regularização", e não como autorização própria. Vale substituir pelo ato definitivo quando o CME publicar.

### Associações prováveis ou a conferir

| Unidade | Resolução | Relação | Confiança | Nota |
|---|---|---|---|---|
| UN-174 Escola Municipal De Educacao Quilombola De Sucurijuquara Arlinda Gomes | 08/2000 | autorização de funcionamento | media | Ligação por nome antigo: "Angelus Nascimento" consta como nome antigo da unidade no cadastro. |
| UN-126 Escola Municipal Maria Madalena Correa Raad | 13/2000 | autorização de funcionamento | media | Ato cita "Madalena Raad" (sem "Maria" e sem "Correa"); associada à EM Maria Madalena Correa Raad por inferência do sobrenome. |
| UN-216 Escola Municipal Joao Nelson Ribeiro | 32/2000 | autorização de funcionamento | media | Ato cita só o nome base "João Nelson Ribeiro"; existe também a variante UN-212 (João Nelson Ribeiro I). Associada à base. |
| UN-118 Escola Municipal Maria Stellina Valmont | 13/2001 | autorização de funcionamento | media | Ato cita "Stelina Valmont"; cadastro tem EM Maria Stellina Valmont (grafia/nome abreviado). |
| UN-211 Escola Municipal Ines Maroja | 16/2001 | autorização de funcionamento | media | Ato cita "Inês de Mendonça Maroja"; cadastro tem EM Inês Maroja (nome abreviado, mesma pessoa homenageada nas resoluções 2000-p9). |
| UN-211 Escola Municipal Ines Maroja | 17/2001 | autorização de funcionamento | media | Ato cita "Inês de Mendonça Maroja"; cadastro tem EM Inês Maroja (nome abreviado). |
| UN-023 Instituto Unidos Venceremos | 11/2002 | credenciamento | media | Entidade mantenedora: Centro Comunitário Unidos Venceremos; unidade do cadastro leva o nome Instituto Unidos Venceremos (mesma escola de educação infantil Unidos Venceremos). Associação por entidade/nome. |
| UN-018 Centro Comunitario Nossa Senhora Do Perpetuo Socorro | 02/2003 | credenciamento | media | Entidade mantenedora (Centro Comunitário N. Sra. do Perpétuo Socorro) casa com a unidade de mesmo nome; não é a EM Perpétuo Socorro (UN-217) nem a EM Prof. Perpétuo Socorro Jesus Figueiredo (UN-061). |
| UN-093 Associacao De Pais E Educadores Moarana | 08/2003 | credenciamento | media | Credenciamento da entidade mantenedora Associação de Pais e Educadores Moaraná; casa com a unidade de mesmo nome. |
| UN-198 Acao Social Da Matinha | 17/2003 | credenciamento | media | Entidade/creche: Ação Social da Matinha (Creche Irmã Dulce); ato também autoriza funcionamento provisório. |
| UN-017 Anexo Solar Acalanto Da Em Benvinda De Franca Messias | 19/2003 | credenciamento | media | Grupo Assistencial Solar do Acalanto casa com o Anexo Solar Acalanto da EM Benvinda de França Messias; ato também autoriza funcionamento provisório. |
| UN-116 Associacao Dos Amigos Da Terra Firme | 25/2003 | credenciamento | media | Entidade Associação dos Amigos da Terra Firme; ato também autoriza funcionamento provisório. Não é a EM Terra Firme (UN-122). |
| UN-114 Escola Municipal Manuela Freitas | 26/2003 | autorização de funcionamento | media | Ato grafa "Manuel Freitas"; cadastro tem EM Manuela Freitas (grafia). |
| UN-016 Escola Municipal Francisco Da Silva Nunes | 10/2004 | autorização de funcionamento | media | Ato cita "Prof. Francisco Nunes"; associada à EM Francisco da Silva Nunes por nome abreviado. |
| UN-138 Centro Social E Cultural Dr Osvaldo Melo | 14/2004 | credenciamento | media | Entidade mantenedora Centro Social e Cultural Dr. Osvaldo de Melo (escola em convênio "Nossa Senhora da Conceição"); ato também autoriza funcionamento provisório. |
| UN-049 Associacao C Do Bairro Do Tapana | 15/2004 | autorização de funcionamento | baixa | "Escola Comunitária do Tapanã" não consta com esse nome; possível relação com Associação C. do Bairro do Tapanã (UN-049), sem confirmação. Conferir. |
| UN-216 Escola Municipal Joao Nelson Ribeiro | 06/2005 | autorização de funcionamento | media | Ato cita só o nome base "João Nelson Ribeiro"; existe também a variante UN-212 (João Nelson Ribeiro I). Associada à base. |
| UN-029 Escola Municipal Cristo Redentor | 11/2005 | credenciamento | media | Entidade Sociedade Cooperativista Cristo Redentor / Escola em Regime de Convênio Cristo Redentor; ligação por nome igual ao da EM Cristo Redentor do cadastro (criada por decreto em 2025). Ato também autoriza funcionamento provisório. |
| UN-174 Escola Municipal De Educacao Quilombola De Sucurijuquara Arlinda Gomes | 02/2007 | autorização de funcionamento | media | Ato cita Prof. Ângelus Nascimento, nome antigo da atual EM de Educação Quilombola de Sucurijuquara Arlinda Gomes. |
| UN-001 Escola Municipal Professora Maria Auxiliadora Martins Goncalves | 15/2007 | autorização de funcionamento | media | UEI Caripunas é nome antigo da EM Maria Auxiliadora Martins Gonçalves (Batista Campos). |
| UN-092 Escola Municipal Venuzina Marinho De Souza | 22/2007 | autorização de funcionamento | media | UEI Cremação é nome antigo da EM Venuzina Marinho de Souza. |
| UN-018 Centro Comunitario Nossa Senhora Do Perpetuo Socorro | 08/2008 | autorização de funcionamento | baixa | Alternativa por nome igual; ver nota da outra associação. |
| UN-217 Escola Municipal Perpetuo Socorro | 08/2008 | autorização de funcionamento | baixa | UEI Nossa Senhora do Perpétuo Socorro (2008): pode ser a EM Perpétuo Socorro (criada por portaria em 2007, série de UEIs) ou o Centro Comunitário N. Sra. do Perpétuo Socorro (UN-018, nome igual). |
| UN-111 Escola Municipal Rotary | 14/2008 | autorização de funcionamento | baixa | UEI Rotary: nome igual à EM Rotary (Jurunas), mas a série de UEIs de 2007/2008 inclui a EM Rotary Club (Mosqueiro, UN-164). |
| UN-164 Escola Municipal Rotary Club | 14/2008 | autorização de funcionamento | baixa | Alternativa: EM Rotary Club criada por portaria em 2007 como UEI. |
| UN-008 Escola Municipal Professora Lucia Soares Castro | 15/2008 | autorização de funcionamento | media | UEI Primeiro de Dezembro corresponde ao nome antigo "1º de Dezembro" da EM Lúcia Soares Castro. |
| UN-048 Escola Municipal Professora Cleonice Oliveira Conceicao | 16/2008 | autorização de funcionamento | media | UEI Cordeiro de Farias é nome antigo da EM Cleonice Oliveira Conceição. |
| UN-047 Escola Municipal Sao Joao Paulo Ii | 20/2008 | autorização de funcionamento | media | UEI São José é nome antigo da EM São João Paulo II; EM de Educação do Campo São José (UN-183) é escola rural distinta. |
| UN-197 Escola Municipal Iza Cunha | 24/2008 | autorização de funcionamento | media | UEI Isa Cunha corresponde à EM Iza Cunha (grafia diferente), criada por portaria em 2007. |
| UN-045 Escola Municipal Pratinha | 26/2008 | autorização de funcionamento | media | Ato cita só UEI Pratinha; há também Pratinha II (UN-046), ambas com Pratinha como nome antigo. Associada à base. |
| UN-176 Escola Municipal Itaiteua | 28/2008 | autorização de funcionamento | media | UEI Itateua corresponde à EM Itaiteua (grafia diferente), Outeiro. |
| UN-110 Escola Municipal Professora Rosenil Cordeiro Da Silva | 33/2008 | autorização de funcionamento | media | UEI São Silvestre é nome antigo da EM Rosenil Cordeiro da Silva. |
| UN-107 Escola Municipal Honorato Filgueiras | 09/2009 | autorização de funcionamento | media | Ato cita só Honorato Filgueiras; existe também Honorato Filgueiras I (UN-108). Associada à base. |
| UN-021 Escola Municipal Professora Angelica Do Carmo Santos Paiva | 11/2009 | autorização de funcionamento | media | UEI Benguí é nome antigo da EM Angélica do Carmo Santos Paiva. |
| UN-211 Escola Municipal Ines Maroja | 14/2009 | autorização de funcionamento | media | Prof.ª Inês de Mendonça Maroja associada à EM Inês Maroja (Sacramenta) por nome abreviado. |
| UN-191 Escola Municipal Casa Da Pesca | 23/2009 | autorização de funcionamento | media | Casa Escola da Pesca (CEPE) associada à EM Casa da Pesca (Outeiro) por nome semelhante. |
| UN-132 Escola Municipal Genesis | 04/2010 | autorização de funcionamento | media | UEI Maguari é nome antigo da EM Gênesis. |
| UN-148 Escola Municipal Ciro Pimenta | 13/2010 | autorização de funcionamento | media | Ato cita "Ciro das Chagas Pimenta"; cadastro tem "Ciro Pimenta" (Parque Guajará, Icoaraci); ligação por nome abreviado, sem confirmação de endereço. |
| UN-148 Escola Municipal Ciro Pimenta | 14/2010 | autorização de funcionamento | media | Ato cita "Ciro das Chagas Pimenta"; cadastro tem "Ciro Pimenta" (Parque Guajará, Icoaraci); ligação por nome abreviado, sem confirmação de endereço. |
| UN-148 Escola Municipal Ciro Pimenta | 16/2010 | autorização de funcionamento | media | Ato cita "Ciro das Chagas Pimenta"; cadastro tem "Ciro Pimenta" (Parque Guajará, Icoaraci); ligação por nome abreviado, sem confirmação de endereço. |
| UN-084 Escola Municipal Paulo Almeida Brasil | 25/2010 | autorização de funcionamento | media | Ato cita a Unidade Pedagógica "Paulo de Almeida Brasil"; cadastro tem a EM Paulo Almeida Brasil (Souza), hoje escola autônoma, em outro bairro que a Alzira Pernambuco; ligação por nome. |
| UN-137 Centro Educacional Mundo Da Imaginacao | 26/2010 | autorização de funcionamento | media | Ato cita "Centro de Desenvolvimento Infantil Mundo da Imaginação"; cadastro tem Centro Educacional Mundo da Imaginação; mesmo nome de fantasia, denominação institucional diferente. |
| UN-083 Escola Municipal Santa Rita De Cassia | 04/2011 | autorização de funcionamento | media | Unidade Pedagógica "Santa Rita de Cássia" vinculada à Palmira Lins (Marambaia); escolhida a EM Santa Rita de Cássia (Marambaia) e não a Associação Santa Rita de Cássia (UN-113, Marco), pelo bairro. |
| UN-115 Escola Municipal Santo Agostinho | 10/2011 | renovação de autorização | media | Ato cita "Unidade de Educação Infantil Santo Agostinho"; há também EM Santo Agostinho da Aldeia (UN-085, Canudos); associado ao nome exato (UN-115). |
| UN-171 Escola Municipal Maroja Neto | 13/2011 | autorização de funcionamento | media | Trata da Unidade Pedagógica "Desembargador Maroja Neto" vinculada à escola homônima; associado à escola do cadastro. |
| UN-171 Escola Municipal Maroja Neto | 15/2011 | autorização de funcionamento | media | Trata da Unidade Pedagógica "Desembargador Maroja Neto" vinculada à escola homônima; associado à escola do cadastro. |
| UN-171 Escola Municipal Maroja Neto | 16/2011 | autorização de funcionamento | media | Trata da Unidade Pedagógica "Desembargador Maroja Neto" vinculada à escola homônima; associado à escola do cadastro. |
| UN-157 Escola Municipal De Educacao Do Campo Maria Clemildes | 17/2011 | autorização de funcionamento | media | Unidade Pedagógica "Castanhal do Mari-Mari" corresponde ao nome antigo de UN-157 (já registrado no cadastro). |
| UN-029 Escola Municipal Cristo Redentor | 01/2012 | recredenciamento | media | Renovação de credenciamento da Sociedade Beneficente e Cooperativista Cristo Redentor e autorização da Educação Infantil na "Escola de Educação Básica em Regime de Convênio Cristo Redentor"; ligada à EM Cristo Redentor (Coqueiro) por nome, sem confirmação de endereço. |
| UN-107 Escola Municipal Honorato Filgueiras | 07/2012 | prorrogação de autorização | media | Ato cita apenas "Prof. Honorato Filgueiras"; existe também Honorato Filgueiras I (UN-108, criada em 2025); associado à base. |
| UN-042 Escola Municipal Cordolina Fontelles De Lima | 08/2012 | autorização de funcionamento | media | Unidade Pedagógica "Cordolina Fonteles" (grafia diferente de Cordolina Fontelles de Lima), ligada por nome; ambas em Icoaraci. |
| UN-211 Escola Municipal Ines Maroja | 12/2012 | autorização de funcionamento | media | Ato cita "Prof.ª Inês de Mendonça Maroja"; cadastro tem EM Inês Maroja (Sacramenta); ligação por nome abreviado. |
| UN-007 Escola Municipal Lions Clube De Belem | 14/2012 | autorização de funcionamento | media | Unidade Pedagógica "Lyons Clube" corresponde provavelmente à atual EM Lions Clube de Belém (mesmo bairro, Marco); grafia diferente. |
| UN-174 Escola Municipal De Educacao Quilombola De Sucurijuquara Arlinda Gomes | 17/2012 | autorização de funcionamento | media | "Ângelus Nascimento" é nome antigo de UN-174 (já registrado no cadastro); Distrito de Mosqueiro confere. |
| UN-174 Escola Municipal De Educacao Quilombola De Sucurijuquara Arlinda Gomes | 18/2012 | autorização de funcionamento | media | "Ângelus Nascimento" é nome antigo de UN-174 (já registrado no cadastro); Distrito de Mosqueiro confere. |
| UN-125 Escola Municipal Liceu Mestre Raimundo Cardoso | 27/2012 | autorização de funcionamento | media | Ato cita "Liceu de Artes e Ofícios Mestre Raimundo Cardoso"; cadastro tem EM Liceu Mestre Raimundo Cardoso; mesmo nome com denominação anterior mais longa. |
| UN-107 Escola Municipal Honorato Filgueiras | 01/2013 | autorização de funcionamento | media | Ato cita apenas "Prof. Honorato Filgueiras"; existe também Honorato Filgueiras I (UN-108, criada em 2025); associado à base. |
| UN-193 Escola Municipal Professora Renildes Nunes Batista | 07/2013 | autorização de funcionamento | baixa | Unidade Pedagógica "Fidélis" (Outeiro); só o endereço de UN-193 cita a Comunidade do Fidelis; hipótese não confirmada de que a UP deu origem à EM Renildes Nunes Batista. |
| UN-068 Escola Municipal Verdejante | 22/2013 | autorização de funcionamento | media | Ato cita Unidade Pedagógica "Verdejante"; existe também Verdejante I (UN-069, criada 2025); associado à base. |
| UN-021 Escola Municipal Professora Angelica Do Carmo Santos Paiva | 05/2014 | autorização de funcionamento | media | "Benguí" é nome antigo de UN-021 (já registrado no cadastro). |
| UN-216 Escola Municipal Joao Nelson Ribeiro | 14/2014 | autorização de funcionamento | media | Ato cita "João Nelson Ribeiro" sem variante; existe também UN-212 (João Nelson Ribeiro I). Associada à unidade base. |
| UN-047 Escola Municipal Sao Joao Paulo Ii | 18/2014 | autorização de funcionamento | media | Unidade de Educação Infantil "São José": nome antigo de UN-047 (São João Paulo II) no cadastro. Existe homônima rural UN-183 (EM de Educação do Campo São José), não associada por ser UEI urbana sem menção a distrito. |
| UN-113 Associacao Santa Rita De Cassia | 27/2014 | credenciamento | media | Credencia a entidade Associação de Santa Rita de Cássia (UN-113) e autoriza a Creche e Pré-Escola Santa Rita de Cássia (mesma unidade); autorização de funcionamento citada aqui. Não se trata da EM Santa Rita de Cássia (UN-083). |
| UN-110 Escola Municipal Professora Rosenil Cordeiro Da Silva | 31/2014 | autorização de funcionamento | media | UEI "São Silvestre": nome antigo de UN-110 (Rosenil Cordeiro da Silva) conforme cadastro. |
| UN-041 Escola Municipal Florestan Fernandes | 35/2014 | autorização de funcionamento | media | Ato cita "Prof. Florestan Fernandes" sem anexo; existe também UN-040 (Anexo Florestan Fernandes). Associada à sede. |
| UN-001 Escola Municipal Professora Maria Auxiliadora Martins Goncalves | 36/2014 | autorização de funcionamento | media | UEI "Caripunas": nome antigo de UN-001 conforme cadastro. |
| UN-048 Escola Municipal Professora Cleonice Oliveira Conceicao | 38/2014 | autorização de funcionamento | media | UEI "Cordeiro de Farias": nome antigo de UN-048 (Cleonice) conforme cadastro. |
| UN-152 Escola Municipal Professor Jaime Da Costa Teixeira | 13/2015 | autorização de funcionamento | media | UEI "Jaime Teixeira" sem correspondência exata; inferido como a atual EM Prof. Jaime da Costa Teixeira (Tenoné/Icoaraci, DAICO) por nome. |
| UN-081 Escola Municipal Professora Aurora Guimares Vieira | 15/2015 | autorização de funcionamento | media | UEI "Marambaia": nome antigo de UN-081 conforme cadastro. |
| UN-137 Centro Educacional Mundo Da Imaginacao | 20/2015 | credenciamento | media | Entidade Associação de Moradores Morada de Deus I e II; unidade "Centro de Desenvolvimento Infantil Mundo da Imaginação" ligada ao Centro Educacional Mundo da Imaginação (UN-137) pelo nome. Também autoriza funcionamento. |
| UN-216 Escola Municipal Joao Nelson Ribeiro | 24/2015 | autorização de funcionamento | media | Ato cita "Prof. João Nelson Ribeiro" sem variante; existe também UN-212 (João Nelson Ribeiro I). Associada à unidade base. |
| UN-100 Escola Municipal Padre Leandro Pinheiro | 03/2016 | outro | media | Arquivamento de processo de autorização da EM "Padre Leandro"; nome parcial de EM Padre Leandro Pinheiro (UN-100). |
| UN-023 Instituto Unidos Venceremos | 07/2016 | credenciamento | media | Entidade mantenedora; ligação pelo nome da entidade. Sociedade Unidos Venceremos/Creche Unidos Venceremos ~ Instituto Unidos Venceremos. Também autoriza funcionamento. |
| UN-130 C C Sao Paulo | 10/2016 | credenciamento | media | Entidade mantenedora; ligação pelo nome da entidade. Centro Comunitário São Paulo ~ C C São Paulo. Também autoriza funcionamento. |
| UN-156 Fundacao Crianca Feliz | 12/2016 | credenciamento | media | Entidade mantenedora; ligação pelo nome da entidade. Também autoriza funcionamento. |
| UN-034 Associacao Beneficente Sao Carlos Do Brasil | 13/2016 | credenciamento | media | Entidade mantenedora; ligação pelo nome da entidade. Também autoriza funcionamento. |
| UN-208 C C Uniao Dos Amigos Do Bairro Da Sacramenta | 14/2016 | credenciamento | media | Entidade mantenedora; ligação pelo nome da entidade. Também autoriza funcionamento. |
| UN-051 C C Educ Sao Francisco De Assis | 16/2016 | credenciamento | media | Entidade mantenedora; ligação pelo nome da entidade. Centro Comunitário Educacional São Francisco de Assis ~ C C Educ São Francisco de Assis; não são as EMs São Francisco de Assis. Também autoriza funcionamento. |
| UN-137 Centro Educacional Mundo Da Imaginacao | 01/2017 | credenciamento | media | Entidade Associação de Moradores Morada de Deus I e II; Centro de Desenvolvimento Infantil Mundo da Imaginação ligado a UN-137 pelo nome. Também autoriza funcionamento. |
| UN-116 Associacao Dos Amigos Da Terra Firme | 03/2017 | credenciamento | media | Entidade mantenedora; ligação pelo nome da entidade. Ato diz "Associação dos Amigos do Bairro da Terra Firme"; cadastro: Associação dos Amigos da Terra Firme. Também autoriza funcionamento. |
| UN-093 Associacao De Pais E Educadores Moarana | 04/2017 | credenciamento | media | Entidade mantenedora; ligação pelo nome da entidade. Também autoriza funcionamento. |
| UN-198 Acao Social Da Matinha | 05/2017 | credenciamento | media | Entidade mantenedora; ligação pelo nome da entidade. Também autoriza funcionamento. |
| UN-049 Associacao C Do Bairro Do Tapana | 09/2017 | credenciamento | media | Entidade mantenedora; ligação pelo nome da entidade. Escola Comunitária do Bairro do Tapanã. Também autoriza funcionamento. |
| UN-018 Centro Comunitario Nossa Senhora Do Perpetuo Socorro | 10/2017 | credenciamento | media | Entidade mantenedora; ligação pelo nome da entidade. Também autoriza funcionamento. |
| UN-050 Associacao De Moradores Do Residencial Bom Jesus | 12/2017 | credenciamento | media | Entidade mantenedora; ligação pelo nome da entidade. Também autoriza funcionamento. |
| UN-094 Associacao Dos Moradores Do Bairro Do Guama | 13/2017 | credenciamento | media | Entidade mantenedora; ligação pelo nome da entidade. Escola de Educação Infantil Santa Helena. Também autoriza funcionamento. |
| UN-138 Centro Social E Cultural Dr Osvaldo Melo | 14/2017 | credenciamento | media | Entidade mantenedora; ligação pelo nome da entidade. Também autoriza funcionamento. |
| UN-146 Escola Comunitaria De Ensino Infantil Alameda Das Palmeiras | 17/2017 | credenciamento | media | Entidade mantenedora; ligação pelo nome da entidade. Associação Centro Comunitário dos Moradores da Alameda das Palmeiras ~ Escola Comunitária de Ensino Infantil Alameda das Palmeiras. Também autoriza funcionamento. |
| UN-143 Sociedade Beneficente Pequeninos De Cristo Creche Edelburga Queiroz | 18/2017 | credenciamento | media | Entidade mantenedora; ligação pelo nome da entidade. Sociedade Beneficente Pequeninos de Cristo (Creche Edelburga Queiroz). Também autoriza funcionamento. |
| UN-094 Associacao Dos Moradores Do Bairro Do Guama | 19/2017 | credenciamento | baixa | Entidade "Associação Comunitária do Bairro do Guamá" difere do nome do cadastro (Associação dos Moradores do Bairro do Guamá, UN-094, objeto da Res. 13/2017); pode ser a mesma entidade ou outra não cadastrada. |
| UN-129 Sociedade Comunitaria Sao Joao Batista | 20/2017 | credenciamento | media | Entidade mantenedora; ligação pelo nome da entidade. Também autoriza funcionamento. |
| UN-116 Associacao Dos Amigos Da Terra Firme | 21/2017 | credenciamento | baixa | Entidade "Associação dos Moradores do Bairro da Terra Firme" difere de UN-116 (Associação dos Amigos da Terra Firme, Res. 3/2017); pode ser a mesma entidade ou outra não cadastrada. |
| UN-214 Associacao De Moradores Das Pass Santa Rita E Joana Darc | 23/2017 | credenciamento | media | Entidade mantenedora; ligação pelo nome da entidade. Também autoriza funcionamento. |
| UN-051 C C Educ Sao Francisco De Assis | 03/2018 | prorrogação de autorização | media | Ato cita Sociedade Comunitária São Francisco de Assis (prorroga a Res. 20/2017); ligação ao Centro Comunitário Educacional São Francisco de Assis (credenciado pela Res. 57/2018) é inferência por nome de entidade, possivelmente denominação anterior. |
| UN-143 Sociedade Beneficente Pequeninos De Cristo Creche Edelburga Queiroz | 05/2018 | prorrogação de autorização | media | Ato nomeia apenas a entidade Sociedade Beneficente Pequeninos de Cristo; ligação à unidade com Creche Edelburga Queiroz (Res. 64/2018) por inferência da entidade. |
| UN-208 C C Uniao Dos Amigos Do Bairro Da Sacramenta | 08/2018 | prorrogação de autorização | media | Entidade União dos Amigos do Bairro da Sacramenta; unidade do cadastro leva prefixo C C (Centro Comunitário), ligação por nome da entidade mantenedora. |
| UN-094 Associacao Dos Moradores Do Bairro Do Guama | 12/2018 | prorrogação de autorização | media | Ato nomeia Associação dos Moradores do Bairro do Guamá (nome abreviado no arquivo); ligação por entidade mantenedora. |
| UN-137 Centro Educacional Mundo Da Imaginacao | 13/2018 | prorrogação de autorização | media | Ato cita Associação dos Moradores Morada de Deus I e II; a ligação com a unidade Mundo da Imaginação vem da Res. 05/2019, que recredencia essa entidade com essa escola. |
| UN-146 Escola Comunitaria De Ensino Infantil Alameda Das Palmeiras | 21/2018 | prorrogação de autorização | media | Ato nomeia a Associação dos Moradores da Alameda das Palmeiras (entidade mantenedora); ligação à Escola Comunitária Alameda das Palmeiras por inferência (Res. 68/2018). |
| UN-023 Instituto Unidos Venceremos | 27/2018 | prorrogação de autorização | media | Ato/arquivo cita Creche Escola Unidos Venceremos; unidade do cadastro é Instituto Unidos Venceremos (mesma denominação base, variação de tipo). |
| UN-115 Escola Municipal Santo Agostinho | 36/2018 | autorização de funcionamento | media | Ato cita apenas Unidade de Educação Infantil Santo Agostinho; há também EM Santo Agostinho da Aldeia (UN-085), associada à base por nome exato. Arquivo indica renovação, descrição diz concede autorização. |
| UN-206 Anexo C C Sao Jose Da Em Comandante Klautau | 50/2018 | autorização de funcionamento | media | UP São José identificada com o Anexo C C São José da EM Comandante Klautau (Passagem São José, Sacramenta), por nome e vínculo com a escola sede; não confundir com EM São João Paulo II (ex-São José) nem EMEC São José. |
| UN-191 Escola Municipal Casa Da Pesca | 71/2018 | renovação de autorização | media | Ato cita Casa Escola da Pesca (CEPE); cadastro: EM Casa da Pesca, Itaiteua/Outeiro. |
| UN-008 Escola Municipal Professora Lucia Soares Castro | 74/2018 | renovação de autorização | media | UEI Primeiro de Dezembro é nome antigo da EM Professora Lucia Soares Castro (cadastro: 1º de Dezembro). |
| UN-130 C C Sao Paulo | 84/2018 | recredenciamento | media | Entidade Centro Comunitário São Paulo; a escola citada no ato chama-se Escola São Sebastião, sem unidade própria no cadastro. Ligação por entidade mantenedora. |
| UN-023 Instituto Unidos Venceremos | 04/2019 | recredenciamento | media | Ato cita Sociedade Unidos Venceremos / Creche Comunitária Unidos Venceremos; unidade do cadastro é Instituto Unidos Venceremos. |
| UN-137 Centro Educacional Mundo Da Imaginacao | 05/2019 | recredenciamento | media | Ato cita Escola Centro de Desenvolvimento Infantil Mundo da Imaginação; cadastro: Centro Educacional Mundo da Imaginação. |
| UN-083 Escola Municipal Santa Rita De Cassia | 14/2019 | renovação de autorização | media | UP Santa Rita de Cássia identificada com EM Santa Rita de Cassia (Marambaia, mesmo bairro da sede); há também a Associação Santa Rita de Cássia (UN-113, Marco), não associada. |
| UN-206 Anexo C C Sao Jose Da Em Comandante Klautau | 17/2019 | renovação de autorização | media | UP São José inferida como o anexo C C São José da EM Comandante Klautau (mesmo bairro/escola); não é UN-047 (antigo São José, Pratinha) nem UN-183. |
| UN-113 Associacao Santa Rita De Cassia | 18/2019 | recredenciamento | media | Entidade mantenedora Associação Santa Rita de Cássia casa com UN-113; o ato também renova a autorização da Creche Santa Rita de Cássia. UN-083 (EM Santa Rita de Cássia, Marambaia) é outra escola. |
| UN-039 Sistema De Ensino Infantil Paulo Guilherme Tomaz | 19/2019 | credenciamento | media | Centro de Educação Infantil Carmelândia teve o nome alterado para Sistema de Ensino Infantil Paulo Guilherme (Res. 10/2022); o ato também autoriza o funcionamento. |
| UN-095 Centro Catequetico De Promocao Humana Santa Izabel Da Hungria | 20/2019 | credenciamento | media | Entidade mantenedora Centro Catequético e de Promoção Humana Santa Izabel da Hungria casa com UN-095; unidade chamada Oásis Infantil São João Antonio Farina; o ato também autoriza o funcionamento. |
| UN-068 Escola Municipal Verdejante | 27/2019 | renovação de autorização | baixa | UP Verdejante: pode ser UN-068 (EM Verdejante) ou UN-069 (Verdejante I), ou nenhuma do cadastro; associação por coincidência de nome. |
| UN-197 Escola Municipal Iza Cunha | 44/2019 | renovação de autorização | media | Grafia 'Isa Cunha' no ato; assumida como UEI Iza Cunha (UN-197), tratada na Res. 63/2019. |
| UN-164 Escola Municipal Rotary Club | 49/2019 | renovação de autorização | baixa | UEI Rotary Clube Belém de Nazaré: sem correspondência segura; UN-164 (EM Rotary Club, criada por portaria de 2007 como UEI) é a mais provável; alternativa UN-111 (EM Rotary, objeto da Res. 56/2019). |
| UN-068 Escola Municipal Verdejante | 54/2019 | renovação de autorização | baixa | UP Verdejante: pode ser UN-068 (EM Verdejante) ou UN-069 (Verdejante I), ou nenhuma do cadastro; associação por coincidência de nome. |
| UN-016 Escola Municipal Francisco Da Silva Nunes | 55/2019 | renovação de autorização | media | Ato cita 'Francisco Nunes da Silva'; cadastro registra 'Francisco da Silva Nunes' (ordem do nome invertida), escola-sede do anexo Barão de Mamoré. |
| UN-205 Escola Municipal Visconde De Inhauma | 59/2019 | renovação de autorização | media | UP Visconde de Inhaúma associada à EM Visconde de Inhaúma (Pedreira, mesmo bairro da EM Palmira); inferência por nome e localização. |
| UN-062 Escola Municipal Nova Esperanca | 60/2019 | renovação de autorização | baixa | UP Nova Esperança: possível EM Nova Esperança (UN-062), mas fica em outro bairro (Una); associação por coincidência de nome. |
| UN-021 Escola Municipal Professora Angelica Do Carmo Santos Paiva | 61/2019 | renovação de autorização | media | UEI Benguí é nome antigo da EM Prof.ª Angélica do Carmo Santos Paiva (já registrado). |
| UN-146 Escola Comunitaria De Ensino Infantil Alameda Das Palmeiras | 08/2020 | renovação de autorização | media | UP Alameda das Palmeiras associada à Escola Comunitária de Ensino Infantil Alameda das Palmeiras. |
| UN-120 Escola Municipal Sao Francisco De Assis | 10/2020 | renovação de autorização | media | UP São Francisco de Assis associada à EM São Francisco de Assis (Terra Firme, mesmo bairro da EM Solerno Moreira); alternativas UN-051 e UN-091 descartadas por bairro. |
| UN-030 Escola Municipal Padre Bruno Sechi | 14/2020 | autorização de funcionamento | media | EMEIF Satélite é nome antigo da EM Padre Bruno Sechi (já registrado). |
| UN-174 Escola Municipal De Educacao Quilombola De Sucurijuquara Arlinda Gomes | 17/2020 | renovação de autorização | media | Angelus Nascimento é nome antigo da EM de Educação Quilombola de Sucurijuquara Arlinda Gomes (já registrado). |
| UN-106 Anexo Grupo C Uniao Da Em Nestor Nonato Lima | 21/2020 | renovação de autorização | media | UP União associada ao anexo Grupo C União da EM Nestor Nonato Lima. |
| UN-193 Escola Municipal Professora Renildes Nunes Batista | 22/2020 | renovação de autorização | media | UP Fidélis inferida como a EM Renildes Nunes Batista (Comunidade do Fidelis, Outeiro). |
| UN-216 Escola Municipal Joao Nelson Ribeiro | 26/2020 | renovação de autorização | media | Ato cita só 'João Nelson Ribeiro'; associada à base e não à variante I (UN-212). UP Nelsinho não localizada no cadastro. |
| UN-007 Escola Municipal Lions Clube De Belem | 04/2023 | renovação de autorização | media | Unidade anexa Lions Club associada à EM Lions Clube de Belém (mesmo bairro, Marco). |
| UN-030 Escola Municipal Padre Bruno Sechi | 21/2023 | renovação de autorização | media | EMEIF Satélite é nome antigo da EM Padre Bruno Sechi (já registrado). |
| UN-062 Escola Municipal Nova Esperanca | 40/2024 | renovação de autorização | media | Anexo 'Nova Esperança' associado à EM Nova Esperança (Una) por nome; cadastro não traz vínculo de anexo, possível homônimo. |
| UN-191 Escola Municipal Casa Da Pesca | 44/2024 | renovação de autorização | media | Ato cita 'EMEF Casa-Escola da Pesca'; cadastro 'Escola Municipal Casa da Pesca' (Itaiteua, Outeiro). |
| UN-180 Anexo Nsra Dos Navegantes Varzea Da Em De Educ Do Campo Sao Jose | 47/2024 | renovação de autorização | media | Anexo 'UP Nossa Senhora dos Navegantes'; no cadastro é anexo da EMEC São José (não de Milton Monte), reorganização posterior. |
| UN-183 Escola Municipal De Educacao Do Campo Sao Jose | 47/2024 | renovação de autorização | media | Anexo 'EMEC São José'; cadastro a registra como sede (EM de Educação do Campo São José), com decreto de 2025. Não é UN-047. |
| UN-056 Escola Municipal Nossa Senhora Aparecida | 17/2025 | renovação de autorização | media | Anexa 'UP Nossa Senhora Aparecida'; cadastro tem EM Nossa Senhora Aparecida como sede (Tapanã), mesmo bairro. |
| UN-034 Associacao Beneficente Sao Carlos Do Brasil | 30/2025 | outro | media | Aditamento à Res. 32/2023 (Creche e Pré-Escola Luna Flexa Ribeiro, mantida pela Assoc. Beneficente São Carlos do Brasil); ligação inferida pela Res. 32/2023. |

### Unidades sem nenhuma resolução do CME

São unidades ativas para as quais o site do CME não tem resolução com o nome delas (nem com nomes antigos conhecidos). São as mesmas 24 unidades que o cadastro já marca como "NÃO LOCALIZADO NO SITE DO CME BELÉM": a busca pelo nome, por nomes antigos e pelo endereço confirmou que o site não publica resolução para elas. Para o restante das 29 unidades "não localizadas", 5 ganharam resolução (escolas que mudaram de nome).

| Unidade | Nome | Ato de autorização no cadastro |
|---|---|---|
| UN-005 | Centro Educacional Arte De Educar Osc Anexo Instituto Acelera Amazonia | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-011 | Centro De Referencia De Educacao Infantil Prof Orlando Bitar | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-025 | Centro Educacional Eu Amo Eu Cuido | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-052 | Cse Meu Amigo Jhon Tapana Osc Anexo Instituto Juntos E Aliancados | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-057 | Escola Municipal Nosso Lar | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-059 | Escola Municipal Professora Aldair Neri Lopes | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-060 | Escola Municipal Professora Elvira Sacramento De Quadros | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-064 | Escola Municipal Jardim Nova Vida | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-072 | Centro Educacional Farol Do Saber | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-075 | Cse Meu Amigo Jhon Curio Utinga Osc Anexo Instituto Acelera Amazonia | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-097 | Escola Municipal Direito De Ser Crianca | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-101 | Escola Municipal Professor Luiz Carlos Acacio Barbosa | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-104 | Instituto Maria E Marias | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-112 | Instituto Pedro Vieira | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-123 | Instituto Juntos E Aliancados | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-133 | Anexo Escola Mestra Idalina Rodrigues Pereira Da Em Ogilvanise Moreira De Moura | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-144 | Creche Miranda | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-145 | Cse Meu Amigo Jhon Icoaraci Osc Anexo Instituto Acelera Amazonia | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-162 | Centro Educacional Mosqueiro Osc Anexo Da Associacao De Moradores Do B Guama | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-166 | Instituto Acelera Amazonia | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-167 | Centro Educacional Pedro Vieira Osc Anexo Do Instituto Pedro Vieira | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-172 | Escola Municipal Mosqueiro | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-185 | Associacao Dos Produtores Rurais De Caratateua | NÃO LOCALIZADO NO SITE DO CME BELÉM |
| UN-194 | Cse Meu Amigo Jhon Outeiro Osc Anexo Instituto Acelera Amazonia | NÃO LOCALIZADO NO SITE DO CME BELÉM |

## Quando uma unidade tem várias resoluções

A seção lista da mais antiga para a mais recente: a autorização inicial, as renovações e as prorrogações. Unidades que mudaram de nome (ex.: a antiga UEI que virou EMEI) mostram também as resoluções do nome antigo, marcadas como "Provável — confira" com a explicação na nota.

## Atualização automática (toda segunda-feira)

O workflow `.github/workflows/atualizar-cme.yml` roda toda segunda-feira (e pode ser disparado em *Actions → Atualizar resoluções do CME → Run workflow*). Ele:

1. busca a lista pública do site do CME e separa as resoluções que ainda não conhecia (`scripts/cme/conhecidas.json`);
2. ignora normas gerais, calendários e validação de estudos;
3. liga cada resolução nova às unidades: **confiança alta** quando o próprio cadastro a cita no "Ato de autorização" (ex.: `072/2018 - CME`); **provável** quando o nome da unidade aparece por inteiro na descrição ou no nome do arquivo; **a conferir** quando há mais de uma unidade com nome parecido;
4. abre um **pull request** com o resultado (e uma tabela do que foi ligado). As prováveis e a conferir aparecem em *Conferência de atos*; as que não casam com nenhuma unidade entram em *Atos achados sem unidade no cadastro*.

Nada é aprovado sozinho: o pull request precisa ser mesclado, e cada associação provável continua pedindo a sua confirmação. Para rodar à mão: `npm run cme:atualizar` (use `-- --seco` para só ver o que faria).

**Para o workflow abrir pull requests** é preciso liberar, uma vez, em *Settings → Actions → General → Workflow permissions*, a opção **Allow GitHub Actions to create and approve pull requests**. Como o pull request é aberto pelo próprio GitHub Actions, os testes automáticos não rodam nele sozinhos; abra-o e rode `npm test` ou peça a revisão antes de mesclar.
