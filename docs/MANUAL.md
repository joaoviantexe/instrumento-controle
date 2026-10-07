# Manual de funcionalidades

Instrumento de Controle da Documentação Escolar — CDE/SEMEC.

Este manual descreve cada tela e recurso da aplicação. A aplicação reproduz as 10 abas da planilha
`Instrumento_Controle_Documentacao_Escolar_CDE_SEMEC (4).xlsx`, com os mesmos textos, listas, pesos e fórmulas.

## Sumário

1. [Visão geral e navegação](#1-visão-geral-e-navegação)
2. [Início](#2-início)
3. [Instruções](#3-instruções)
4. [Cadastro Unidades](#4-cadastro-unidades)
5. [Lista Mestra](#5-lista-mestra)
6. [Plano de Auditoria](#6-plano-de-auditoria)
7. [Auditoria Documental](#7-auditoria-documental)
8. [Checklist da Visita](#8-checklist-da-visita)
9. [Plano de Ação](#9-plano-de-ação)
10. [Dashboard](#10-dashboard)
11. [Relatórios](#11-relatórios)
12. [Dados e planilhas](#12-dados-e-planilhas)
13. [Como a pontuação é calculada](#13-como-a-pontuação-é-calculada)
14. [Navegação e impressão](#14-navegação-e-impressão)
15. [Acesso, login e modos de armazenamento](#15-acesso-login-e-modos-de-armazenamento)
16. [Origem dos textos](#16-origem-dos-textos)

---

## 1. Visão geral e navegação

O fluxo segue a aba **Instruções** da planilha:

```
Cadastro Unidades → Plano de Auditoria → Auditoria Documental → (Checklist da Visita)
                                                  ↓
                          Plano de Ação ← não conformidades relevantes
                                                  ↓
                                   Dashboard e Relatórios
```

| Elemento | O que faz |
|---|---|
| **Menu lateral** | Fica sempre visível no computador. Mostra o nome do projeto, as seções na mesma ordem das abas da planilha (agrupadas por linhas separadoras), o modo de armazenamento e, no banco compartilhado, o e-mail logado com o botão **sair**. A seção aberta fica destacada. |
| **Cabeçalho da página** | Título, subtítulo (os textos da aba correspondente) e, à direita, as ações principais da tela (ex.: **Nova unidade**, **Imprimir**). |
| **Busca global** | `Ctrl+K` (ou `/`, ou o botão **Buscar** do menu) abre uma caixa para ir direto a uma **unidade** (por nome, INEP, bairro, diretor(a) ou endereço), **auditoria**, **ação** ou **seção**. Use ↑ ↓ para escolher e `Enter` para abrir. |
| **Celular e tablet** | O menu lateral vira uma gaveta, aberta pelo botão ☰ na barra superior; fecha ao escolher uma seção ou com `Esc`. |

As tabelas permitem **ordenar** clicando no cabeçalho. Os filtros ficam na URL, então é possível copiar o
endereço e enviar a um colega com a mesma visão. No celular, as tabelas viram cartões.

## 2. Início

Para abrir o dia sabendo **o que fazer primeiro**:

- **Precisa de atenção** — cinco linhas com um número e um botão que leva à lista **já filtrada**:
  **Prazo expirado** (ações em aberto com prazo vencido), **NC críticas** (itens de peso 3 "Não conforme"),
  **Validação CDE: Pendente** (ações concluídas aguardando a CDE), **Vigência do ato: vencida** e **Resolução**
  (unidades sem ato informado ou "não localizado"). Quando não há nada pendente, a linha mostra um ✓ verde.
- **Instruções de uso** — os **8 passos** do fluxo, cada um com **barra de progresso real** (ex.: "166 de 217 com Data da atualização")
  e o botão **Acessar**. O **próximo passo** (primeira etapa de andamento ainda incompleta) vem destacado em verde.
- **Plano de ação corretiva**: as 6 ações em aberto com prazo mais próximo (dias restantes em vermelho quando vencidos).
- **Plano de auditoria documental**: as próximas auditorias agendadas, em execução ou planejadas com data.
- **Fontes incorporadas ao instrumento**.
- Aviso quando o banco está vazio, com o caminho para carregar os dados da planilha.

> Os seis indicadores numéricos (Unidades cadastradas, Itens do Checklist…) ficam no **Dashboard**.

## 3. Instruções

Reproduz a aba **Instruções**: os 8 passos do fluxo, a tabela **Critérios de classificação**
(Conforme, Parcialmente conforme, Não conforme, Não se aplica) e as **Fontes incorporadas ao instrumento**.
Cada passo tem um atalho para a tela onde ele é executado.

## 4. Cadastro Unidades

Base territorial com as **217 unidades** (175 municipais e 42 OSC/conveniadas) da aba *Cadastro Unidades*.

**Lista**
- **Botões de distrito** (DABEL, DABEN, DAENT, DAGUA, DAICO, DAMOS, DAOUT, DASAC) com a quantidade de unidades.
- **Busca** por nome, código INEP/MEC, bairro, endereço, diretor(a), secretário(a) ou e-mail — ignora acentos e maiúsculas.
- **Filtros**: Bairro, Rede/Vínculo, Tipo de unidade, Zona, Situação.
- **Pendências cadastrais** (também acessadas pelo painel **Precisa de atenção**): atalho para o passo 1 das Instruções (completar atos legais, vigência, responsáveis e
  data da atualização). Mostra, por exemplo, unidades sem *Portaria*, com *Resolução*
  “NÃO LOCALIZADO”, com *Vigência do ato* vencida (em vermelho), sem diretor(a), sem secretário(a) ou sem telefone.
- **Exportar Excel** da lista filtrada.

**Detalhe da unidade** (clique na linha)
- Todos os 26 campos da planilha agrupados em *Identificação*, *Endereço*, *Atos legais*, *Responsáveis* e *Observações cadastrais*.
- Histórico de auditorias da unidade e suas ações corretivas, com atalhos.
- **Editar**: painel lateral com todos os campos. A *Data da atualização* é preenchida com a data de hoje ao salvar.
  A *Vigência do ato* aceita data (DD/MM/AAAA) ou texto (ex.: DEFINITIVO), como na planilha.
- **Nova auditoria**: abre o formulário do Plano de Auditoria já com a unidade selecionada.
- **Excluir unidade**: só é permitido se a unidade não tiver auditorias. Caso tenha, a aplicação orienta a alterar a
  *Situação* para EXTINTA ou PARALISADA.

**Nova unidade**: botão na faixa azul do topo. Obrigatórios: *Nome da unidade* e *Distrito*.

## 5. Lista Mestra

Os **53 registros** do Checklist da CDE: 41 itens técnicos (peso 1 a 3) e 12 itens de síntese da visita (peso 0).

- Botões por seção (1 a 7) com quantidade de itens; busca; filtro por *Criticidade* (Crítica, Alta, Moderada, Síntese).
- Para cada item: *Código*, *Documento/item de controle*, *Evidência mínima*, *Abrangência/periodicidade*,
  *Criticidade*, *Peso*, *Responsável primário*, *Origem no Checklist* e *Orientação de conferência*.
- Total de pesos e **Exportar Excel**.

A Lista Mestra é a definição do instrumento: não é editável pela interface, para que todas as auditorias usem os mesmos critérios.
Alterações de critérios devem ser feitas em `scripts/extrair_planilha.py` / na planilha-fonte (ver [README](../README.md)).

## 6. Plano de Auditoria

Programação das verificações por unidade — uma linha por auditoria (**217** iniciais, `AUD-001` a `AUD-217`).

- **Botões por situação**: Planejada, Agendada, Em execução, Concluída, Cancelada (e “não informada”).
- **Filtros**: busca, Distrito, Tipo de verificação, Prioridade e “Com itens previstos” (auditorias já abertas na Auditoria Documental).
- **Colunas calculadas automaticamente** (como na planilha): *Itens previstos*, *Itens avaliados*, *Índice ponderado*,
  *NC críticas* e *Checklist da visita concluído*.
- **Nova auditoria**: escolha a unidade digitando parte do nome (busca entre as 217). O ID (`AUD-218`, `AUD-219`…) é gerado
  automaticamente — não há risco de repetir IDs.
- **Planejamento em lote**: marque as caixas à esquerda (ou a caixa do cabeçalho, que seleciona **todas as auditorias da lista filtrada**)
  e clique em **Planejar em lote**. Preencha **apenas o que deve mudar** — Tipo de verificação, Prioridade, Data planejada, Situação e/ou
  Auditor(a)/equipe — e **Aplicar**: os campos em branco permanecem como estão em cada auditoria.
- **Colunas**: o botão **Colunas** escolhe o que aparece na tabela (a escolha fica salva neste navegador). Por padrão ficam ocultas
  *Data realizada*, *Itens previstos*, *Checklist da visita concluído* e *Observações*.
- **Ações por linha**: abrir a *Auditoria Documental*, abrir o *Checklist da Visita*, editar e excluir.
  Excluir uma auditoria apaga também seus registros da Auditoria Documental; as ações do Plano de Ação são mantidas, sem o vínculo.

Listas de opções (idênticas às da planilha): Tipo de verificação — *Visita técnica — checklist integral, Auditoria documental,
Acompanhamento de pendências, Verificação temática, Autoavaliação da unidade*; Prioridade — *Imediata, Alta, Média, Baixa*.

## 7. Auditoria Documental

A tela de trabalho principal: avaliação dos 53 registros de uma auditoria.

1. Escolha a auditoria no campo de busca (por ID ou nome da unidade) — ou chegue aqui pelo Plano de Auditoria.
2. O cabeçalho mostra ID, data, distrito, bairro, auditor(a)/equipe, tipo, situação e o **resumo** (itens previstos, avaliados,
   índice ponderado, NC críticas e checklist concluído), que se atualiza a cada clique.
3. Em cada item, escolha a **Situação**: *Conforme, Parcialmente conforme, Não conforme, Não se aplica* ou *Não avaliado*.
   - O item mostra o *Peso*, os *Pontos* e o *Índice do item* na hora.
   - Ao classificar o primeiro item, a auditoria é aberta (53 itens previstos).
4. **Detalhes** de cada item: *Evidência/localização*, *Achado/observação*, *Requer ação?*, *Prazo*, *Responsável*,
   *Situação da ação*, além da *Orientação de conferência* da Lista Mestra.
   - **Salvamento automático**: cada alteração é gravada ao mudar de campo (textos, 1 s após parar de digitar). Aparece “Salvo”.
   - **Não se aplica** exige justificativa formal (“Justificar formalmente”): enquanto o campo *Achado/observação* estiver vazio, a tela
     mostra um alerta.
5. **Registrar no Plano de Ação**: cria uma ação já com o item, o achado, o responsável e o prazo preenchidos; o item passa a
   *Requer ação? Sim* e mostra um selo com o ID da ação.
6. **Filtros**: Todos / Não avaliado / Não conforme e Parcialmente conforme / Requer ação? Sim.
7. O **índice lateral** leva a cada seção, com o progresso (avaliados/total).
8. Uma **barra de progresso fixa** acompanha a rolagem: itens avaliados (ex.: *2/53*), barra de andamento e **índice ponderado**.
   O botão **Próximo não avaliado** rola até o primeiro item pendente; a opção **Ir ao próximo item ao marcar Conforme**
   avança sozinha depois de cada "Conforme" (a escolha fica salva).
9. **Imprimir** gera a ficha da auditoria.

> Os 12 itens `VIS-01` a `VIS-12` têm peso zero: ficam registrados, mas não alteram o índice (evita dupla contagem).

## 8. Checklist da Visita

Síntese automática dos 12 itens finais (`VIS-01` a `VIS-12`) de uma auditoria, no formato da aba original:
Auditoria, Data da visita, Unidade, Distrito, Auditor(a)/equipe, Conclusão, e a tabela com *Situação*,
*Evidência/localização*, *Achado/observação*, *Requer ação?*, *Responsável* e *Prazo*.

Como na planilha, a tela é somente leitura: alterações são feitas na Auditoria Documental (o botão leva direto à seção 7).
**Imprimir** gera a folha para levar à visita.

## 9. Plano de Ação

Tratamento das não conformidades. A baixa depende de validação da CDE.

- **Botões por situação** (*Não iniciada, Em andamento, Concluída, Vencida, Suspensa*) e “Prazo expirado”
  (ações em aberto com prazo anterior a hoje).
- **Filtros**: busca, Distrito, Prioridade, Validação CDE (*Validada, Pendente, Reprovada*).
- **Dias restantes** calculados a partir do prazo (`prazo − hoje`): verde (> 7), amarelo (≤ 7), vermelho (vencido).
- **Nova ação** / clique na linha para editar. Campos: ID auditoria, Unidade, Código do item, Achado, Ação corretiva,
  Prioridade, Responsável, Data de abertura, Prazo, Situação, Evidência de conclusão, Data de conclusão, Validação CDE.
  Ao marcar *Concluída*, a data de conclusão é sugerida com a data de hoje.
- Ao escolher a *ID auditoria*, a unidade é preenchida sozinha. IDs (`AC-001`…) automáticos.
- **Colunas**: o botão **Colunas** mostra/oculta colunas (por padrão ficam ocultas *ID auditoria*, *Achado*, *Data de abertura*, *Evidência de conclusão* e *Data de conclusão*).
- **Exportar Excel** da lista filtrada.

## 10. Dashboard

Painel executivo, com filtro por **Distrito**:

- **Índice global em destaque** (com a barra de conformidade e "X de Y itens avaliados") ao lado dos demais indicadores:
  Unidades cadastradas, Itens do Checklist, Auditorias registradas, Itens avaliados e Não conformes.
- **Precisa de atenção** (sem filtro de distrito): as mesmas cinco linhas do Início.
- **Situação dos itens avaliados** — barras para cada situação, com quantidade e percentual.
- **Índice ponderado por seção** e **Índice global por distrito** — mostram **onde** a conformidade está mais fraca
  (aparecem quando há itens avaliados; antes disso, orientam a abrir a Auditoria Documental).
- **Unidades cadastradas por distrito e vínculo** — barras empilhadas Municipal × OSC/Conveniada.
- **Plano de auditoria documental** e **Plano de ação corretiva** — situação de cada um, com **Prazo expirado**.
- **Qualidade do cadastro territorial** — cobertura de logradouro, CEP, telefone, e-mail e situação ativa.
- **Abrangência do Checklist por seção** — itens em cada seção.
- **Legenda de gestão**.
- Todos os gráficos têm legenda, valores nos rótulos e dica ao passar o mouse; as cores foram validadas para daltonismo e
  nunca são o único meio de identificação (sempre há rótulo).
- **Imprimir** gera o painel em A4.

## 11. Relatórios

Para as reuniões de gestão:

- **Matriz por seção**: contagem de cada situação, itens registrados e **índice ponderado** por seção (a seção 7 não tem índice, pois seu peso é zero).
- **Distrito e Bairro** (a tabela dinâmica da aba *DistritoBairro*): quantas unidades há em cada bairro, por distrito, com **sombreamento**
  pela quantidade. **Clicar em um número abre a lista de unidades** daquele bairro e distrito.
- **Distribuição das unidades por distrito**: Municipal, OSC/Conveniada, Total e Participação.
- **Consolidação das auditorias**: ID, unidade, situação, índice e checklist da visita.
- Filtro por distrito, **Imprimir** e **Exportar Excel** (4 abas: Relatórios, DistritoBairro, Distribuição por distrito e Consolidação).

## 12. Dados e planilhas

- **Planilha completa**: gera um `.xlsx` com as abas *Cadastro Unidades, Lista Mestra, Plano de Auditoria, Auditoria Documental,
  Plano de Ação* e *Relatórios*, com os mesmos cabeçalhos da planilha original (datas e percentuais formatados, filtros e primeira linha fixa).
- **Atualizar dados com uma planilha**: envie um `.xlsx` (a planilha original atualizada ou o arquivo gerado por *Exportar Excel*).
  O sistema reconhece as abas *Cadastro Unidades, Plano de Auditoria, Auditoria Documental* e *Plano de Ação* (pelo nome da aba ou pelos
  cabeçalhos; a ordem das colunas não importa) e **mostra, antes de gravar**, quantos registros são novos, quantos mudam e quantos ficam iguais
  (clicando no número de alterados vê-se campo a campo o que muda: ~~antes~~ → depois). Só então **Aplicar** grava.
  - *Como cada registro é reconhecido:* unidades pelo **nome** (ou pelo **INEP**, quando ele é único — o INEP se repete entre sede e anexos);
    auditorias e ações pelo **ID**; itens da Auditoria Documental pelo ID da auditoria + texto do item (`AUD-0001` e `AUD-001` são tratados como o mesmo).
  - **Nada é excluído:** o que não está na planilha permanece. Colunas ausentes na planilha não alteram o campo.
  - Unidades novas ganham o próximo `UN-nnn`; ações sem ID ganham o próximo `AC-nnn`.
  - **Avisos** listam o que foi ignorado e por quê (ex.: unidade que não existe no cadastro, ID duplicado, item que não consta na Lista Mestra).
  - Os PDFs anexados **não** fazem parte da planilha: continuam ligados aos registros.
- **Dados da planilha**: recarrega as 217 unidades e 217 auditorias do arquivo original. No banco vazio, é o botão
  **Carregar dados da planilha** (primeira configuração).
- Todas as operações destrutivas pedem confirmação.

## 12-A. Anexos em PDF

Onde há **verificação ou comprovação de documentos**, é possível anexar e abrir PDFs:

| Onde | O que anexar | Tipos de documento |
|---|---|---|
| **Cadastro Unidades → unidade → Documentos** | O PDF do ato (comprova a **vigência**) | Resolução · Portaria · Decreto · Outro documento |
| **Auditoria Documental → cada item → Detalhes** | A evidência do item verificado (selo 📎 no item) | Evidência |
| **Auditoria Documental → Documentos da auditoria** e **Checklist da Visita → Documentos da visita** | Relatório, ata, comprovantes da visita | Relatório da auditoria · Comprovante da visita · Outro documento |
| **Plano de Ação → ação** (depois de salva) | Comprovação da conclusão | Evidência de conclusão |

- **Anexar:** arraste o PDF para a área tracejada ou clique em **Anexar PDF** (vários de uma vez). Escolha o *Tipo de documento* quando houver mais de um.
- **Abrir:** clique no nome do arquivo (abre em nova aba). **Excluir:** ícone da lixeira, com confirmação.
- **Regras:** só PDF (o conteúdo é conferido, não apenas a extensão), de até **10 MB**. Cada anexo guarda nome, tamanho, data e quem anexou.
- **Filtro útil:** *Cadastro Unidades → Pendências cadastrais → "Resolução: sem PDF anexado"* lista quem ainda não tem o PDF do ato.
- Ao excluir uma unidade, auditoria ou ação, os PDFs dela são apagados junto.
- **Armazenamento:** no modo local, os PDFs ficam neste navegador (IndexedDB); no modo compartilhado, no *Storage* privado do Supabase
  (bucket `anexos`; plano gratuito: 1 GB). Só quem está na tabela `membros` consegue ver os arquivos; os links de abertura expiram em 2 minutos.
- Os PDFs **não vão** no *Exportar Excel*.

## 13. Como a pontuação é calculada

Reproduz as fórmulas da planilha (e foi conferida contra a planilha recalculada no LibreOffice, item a item):

| Resultado | Fórmula |
|---|---|
| **Peso aplicável** (col. M) | 0 se *Não se aplica*, vazio ou peso 0; caso contrário, o peso do item |
| **Pontos** (col. N) | *Conforme* = 100% do peso aplicável · *Parcialmente conforme* = 50% · demais = 0 |
| **Índice do item** (col. O) | Pontos ÷ Peso aplicável (vazio se o peso aplicável for 0) |
| **Índice ponderado** da auditoria | Σ Pontos ÷ Σ Peso aplicável |
| **Itens avaliados** | itens com situação diferente de *Não avaliado* |
| **NC críticas** | itens de peso 3 classificados como *Não conforme* |
| **Checklist da visita concluído** | itens VIS avaliados ÷ 12 |
| **Dias restantes** | Prazo − hoje |
| **Índice global** (Dashboard) | Σ Pontos ÷ Σ Peso aplicável de todas as auditorias abertas |

Atenção: *Não avaliado* conta como 0 pontos **dentro** do índice (o peso permanece no denominador). Por isso o índice
de uma auditoria recém-aberta é 0,0% e sobe conforme os itens são avaliados. Já *Não se aplica* sai do cálculo.

## 14. Navegação e impressão

- Navegação por teclado (menus, listas pesquisáveis, painéis com `Esc` para fechar) e foco visível.
- Layout responsivo (celular, tablet e computador) e folhas de impressão próprias.

## 15. Acesso, login e modos de armazenamento

| | **Modo local** | **Banco compartilhado (Supabase)** |
|---|---|---|
| Quando | Sem variáveis de ambiente | Com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` |
| Onde ficam os dados | No navegador do computador | No banco, na nuvem |
| Equipe | Cada pessoa vê só os próprios dados | Todos veem os mesmos dados |
| Login | Não há | E-mail e senha; só e-mails cadastrados em `membros` entram |
| Indicação na tela | “Modo local” | “Banco compartilhado” |
| Auditoria de alterações | — | Cada registro guarda *quem* e *quando* alterou |

Mudanças feitas por outra pessoa aparecem ao recarregar a página ou ao voltar à aba (a cada 60 s no máximo).
Veja [IMPLANTACAO.md](IMPLANTACAO.md) para ativar o banco compartilhado.

## 16. Origem dos textos

Os textos de conteúdo — títulos, subtítulos, passos, critérios, cabeçalhos de colunas, listas de opções, legendas,
notas, nomes e orientações dos 53 itens — vêm **exatamente da planilha**, extraídos automaticamente para
`src/data/planilha.json` (não foram reescritos à mão). Os únicos textos novos são os mínimos de interface:
rótulos de botões (Salvar, Cancelar, Exportar Excel, Imprimir…), mensagens de confirmação/erro, a seção **Dados e planilhas** e o formulário de login.
Eventuais títulos em MAIÚSCULAS na planilha aparecem em caixa de frase em cartões, sem mudar as palavras.
