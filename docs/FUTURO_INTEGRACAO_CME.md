# Futuro: integração com o CME (atos e vigências)

> **Status: ideia para o futuro — nada disso está implementado.** O que já existe e serve de alicerce é o **anexo de PDF**
> (por exemplo, o PDF do ato de autorização na unidade) e a pendência *"Ato de autorização: sem PDF anexado"*.

## 1. O problema

Hoje, atos legais e vigências (ex.: *"Vigência do ato"*, 95 vencidas, 29 atos "NÃO LOCALIZADO") são digitados à mão no
**Cadastro Unidades**. Descobrir que um ato foi renovado, ou localizar o ato de uma escola, exige procurar no site do
Conselho Municipal de Educação (CME) ou perguntar à escola. A ideia é **coletar os atos do CME e associá-los automaticamente às unidades**.

## 2. O que se sabe sobre as fontes (levantamento)

- O site do CME de Belém (`cmebelem.com.br`) publica **resoluções e pareceres organizados por ano**, para leitura/download.
- **Não foi encontrada API, feed (RSS) nem dados abertos** em formato estruturado.
- Portanto, qualquer coleta automática dependeria de **ler as páginas do site** ou de **receber os dados do próprio CME**.

## 3. Caminhos possíveis

| | Caminho | Esforço | Risco | Observação |
|---|---|---|---|---|
| **A** | **Pedir ao CME uma lista periódica** (planilha com nº do ato, data, instituição, etapas, vigência) | Baixo | Baixo | Depende de acordo/boa vontade; é a fonte "oficial" |
| **B** | **Importar a planilha do CME** no sistema (reaproveita o importador de Excel já existente, com um mapeamento próprio) | Médio | Baixo | Combina com A; a conferência é humana |
| **C** | **Coleta automática** das páginas/PDFs do site (rotina agendada que baixa novos atos e extrai número, data, instituição) | Alto | Médio/Alto | Frágil (o site muda), exige OCR/leitura de PDF e **cuidado jurídico**: conferir termos de uso e a LGPD |
| **D** | **Acordo de dados** formal (API ou arquivo recorrente) | Alto (burocrático) | Baixo | Melhor resultado a longo prazo |

**Recomendação:** começar por **A** e, assim que houver arquivo, **B**. Deixar **C** só se o CME não puder fornecer os dados — e então com autorização.

## 4. Desenho proposto (quando for implementado)

1. **Tabela `atos`** (separada das unidades): número/ano, data, instituição citada, etapas/modalidades, tipo (criação, autorização,
   credenciamento, reconhecimento), **vigência**, link/PDF do ato e **origem** (CME, planilha, digitação).
2. **Associação em camadas** entre ato e unidade:
   1. **INEP** (quando o ato cita o INEP) — certeza alta;
   2. **número + data do ato** já registrados no cadastro da unidade — certeza alta;
   3. **nome da instituição semelhante** (comparação aproximada) — apenas **sugestão**.
3. **Fila de conferência humana:** nada altera o cadastro sozinho. A pessoa vê *"Ato 22/2025 → ESCOLA X? (confiança alta)"* e **confirma ou recusa**.
   Ao confirmar, o sistema preenche *Ato de autorização…* e *Vigência do ato* e anexa o PDF.
4. **Alertas de vigência** em 90/60/30 dias antes de vencer (hoje só se vê o que já venceu), no painel **Precisa de atenção**.
5. **PDF anexado como base:** o ato associado fica visível na unidade (já existe a área *Documentos*).

## 5. Perguntas a resolver antes

- Os atos do CME estão em **PDF digitalizado** (imagem) ou com texto selecionável? (muda o esforço de leitura)
- A **vigência** vem publicada no ato, ou precisa ser calculada (data + prazo)?
- Existe um **contato direto no CME** para receber uma lista periódica?
- Qual o **volume mensal** de atos novos? (define se a conferência manual cabe na rotina)
- Há **restrição de uso** dos dados publicados (termos do site, LGPD)?

## 6. Próximo passo sugerido

Conversar com o CME sobre o caminho **A/B** (planilha periódica). Com um exemplo real do arquivo, o importador de planilhas atual
pode ser estendido com um "perfil CME" e a fila de conferência pode ser construída sobre a tabela `atos`.
