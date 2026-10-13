# Ideia: Diário Oficial automático e inteligente

## O ponto de partida

- O site da Prefeitura recusa acessos de fora do Brasil. Por isso **nada do Diário pode rodar num servidor** (GitHub, Cloudflare, nuvem): a leitura acontece no navegador de quem está no Brasil, como a varredura de hoje.
- Já existe: leitura das edições no navegador, separação dos atos sobre escolas, associação às unidades (feita em lote, com leitura e verificação) e a tela *Conferência de atos*.
- O gargalo é o meio do caminho: depois da varredura, **a associação depende de eu receber o arquivo**, e cada correção vira um pull request. O CME já tem a rotina semanal; o Diário pode ter o mesmo grau de automação **dentro do navegador**.

## Como ficaria

```
Edições novas → leitura no navegador → extração de padrões → casamento com as unidades → fila de conferência
                                                                          │
                          ┌────────── unidade achada ──────────┬──────── várias possíveis ────────┬── nenhuma ──┐
                       "Pronto: confirmar"               "Escolha qual é"                 "Possível unidade nova:
                                                                                           cadastrar com estes dados"
```

### 1. Avisar e ler sozinho as edições novas
Ao abrir o site, comparar a última edição lida com a lista do painel e mostrar *"12 edições novas desde 10/10 — Ler agora"* (ou ler ao abrir, em segundo plano). Uma semana tem 5 a 10 edições: leva segundos, não horas.

### 2. Reconhecer padrões de texto, não só palavras soltas
Hoje a varredura guarda o texto do ato. O passo seguinte é extrair campos com regras (e medir o acerto):

| Padrão no texto | O que extrair |
|---|---|
| "Fica criada a EMEI *Prof.ª Fulana* … localizada na *Rua X, bairro Y*" | ação = criação, tipo da unidade, nome, endereço, bairro |
| "Fica extinta a UEI *Z* (INEP 15…) … encaminhar o acervo para a *Escola W*" | extinção da antecessora + escola que recebe o acervo |
| "Passa a denominar-se / nomenclatura" | nome antigo → nome novo |
| "Retifica o Decreto nº 111.991/2024" | liga ao **mesmo** ato e unidade já associados |
| "INEP 15xxxxxx" | casamento direto, confiança máxima |

Há material para calibrar: 1.520 atos lidos e 161 já conferidos, que servem de gabarito para medir acerto antes de confiar.

### 3. Casar com o cadastro dentro do site
Levar para o navegador a lógica que hoje roda em Python: nome distintivo da escola, nomes antigos, INEP, endereço e proximidade de texto. Resultado de cada ato:
- **uma unidade com alta certeza** → aparece como "pronto para confirmar";
- **mais de uma possível** (I/II, anexo e sede) → o administrador escolhe;
- **nenhuma** → "possível unidade nova", com o botão **Cadastrar unidade** já preenchido (nome, tipo, bairro, ato de criação).

### 4. A fila vira o lugar de trabalho
Em *Conferência de atos*, uma lista "Atos novos do Diário" com **Associar**, **Escolher outra unidade**, **Cadastrar unidade** e **Não é escola**. As decisões ficam no banco (tabelas `atos_diario` e `vinculos`), e os arquivos do repositório viram só a carga inicial. Assim a associação aparece na página da unidade na hora, sem arquivo para me enviar e sem pull request.

### 5. Achar pelo número o que o cadastro já cita
Guardar um índice leve de **todos os títulos** de ato de cada edição (tipo, número, edição, página, algumas centenas de KB). Daí, cada "Decreto nº 97.641/2020" citado no cadastro ganha o link sozinho, mesmo que o texto do ato não tenha sido reconhecido como sendo de escola (é o caso do Decreto 97.641/2020, ainda sem edição).

### 6. Edições escaneadas
As edições antigas (cerca de 2005–2009) têm o corpo do ato como imagem. Uma opção "Ler escaneadas" listaria as edições com páginas sem texto e rodaria OCR no navegador (tesseract.js) em segundo plano, devolvendo o texto para a mesma fila. É lento, mas roda sozinho enquanto a aba está aberta.

### 7. IA só onde sobra dúvida
As regras resolvem a maioria. O que sobrar ambíguo (nomes parecidos, nome antigo, texto cortado) pode ir para leitura por IA em lote, como foi feito agora, com verificação independente. Uma chamada automática a partir do site exigiria uma chave de API num Worker (tem custo); a alternativa é manter o lote sob demanda.

## Ordem sugerida

1. **Índice de títulos** (item 5): pequeno, resolve pendências concretas e prepara o resto.
2. **Aviso de edições novas** (item 1) e **extração de padrões com gabarito** (item 2), medindo o acerto nos 161 atos conferidos.
3. **Casamento no navegador e fila** (itens 3 e 4), com as tabelas no banco.
4. **Retificações e acervo** (parte do item 2) e **OCR** (item 6), conforme a necessidade.

## O que continua humano

Confirmar o que for "provável", escolher entre unidades parecidas, cadastrar unidade nova e decidir quando um PDF enviado à mão pode ser excluído. A automação só prepara e mostra; nada vira "confirmado" sem a sua decisão.
