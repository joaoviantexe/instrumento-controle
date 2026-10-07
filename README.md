# Instrumento de Controle da Documentação Escolar — CDE/SEMEC

Aplicação web que transforma a planilha **Instrumento_Controle_Documentacao_Escolar_CDE_SEMEC** (Coordenadoria de
Documentação Escolar, Secretaria Municipal de Educação e Cultura de Belém) em um sistema prático e completo, com o visual do
portal da SEMEC (`referencia.zip`).

## O que a aplicação faz

| Aba da planilha | Tela | Destaques |
|---|---|---|
| Instruções | Instruções | Fluxo em 8 passos, critérios de classificação, fontes — com atalhos para cada etapa |
| Cadastro Unidades | Cadastro Unidades | 217 unidades; busca, filtros por distrito/bairro/vínculo, pendências cadastrais, edição, nova unidade |
| Lista Mestra | Lista Mestra | 53 registros (41 técnicos + 12 de síntese), com pesos e orientações |
| Plano de Auditoria | Plano de Auditoria | Planejamento por unidade, IDs automáticos, índice e NC críticas calculados |
| Auditoria Documental | Auditoria Documental | Avaliação item a item com pontuação em tempo real e salvamento automático |
| Checklist da Visita | Checklist da Visita | Síntese automática dos 12 itens, pronta para imprimir |
| Plano de Ação | Plano de Ação | Ações corretivas, dias restantes, validação da CDE |
| Dashboard | Dashboard | 6 indicadores, gráficos, qualidade do cadastro, legenda |
| Relatórios | Relatórios | Matriz por seção, distribuição por distrito, consolidação; Excel e impressão |
| DistritoBairro (tabela dinâmica) | Relatórios → Distrito e Bairro | Matriz de unidades por bairro e distrito, clicável |
| — | Dados e planilhas | Exportar Excel; **atualizar os dados enviando uma planilha** (.xlsx) |

Também: **anexos em PDF** (ato de autorização/vigência, evidências, relatórios de auditoria e de ações), busca global (`Ctrl+K`), painel "Precisa de atenção", planejamento em lote, colunas configuráveis, layout para celular e impressão em A4.

📖 **[Manual de funcionalidades](docs/MANUAL.md)** — cada tela e recurso, e como a pontuação é calculada.
🚀 **[Guia de implantação](docs/IMPLANTACAO.md)** — Vercel + Supabase, passo a passo, custo zero.
🛠️ **[Guia prático](docs/GUIA_PRATICO.md)** — passo a passo de cada funcionalidade (ex.: como resolver uma vigência vencida).
🧭 **[Entendendo a planilha e o site](docs/ENTENDENDO_A_PLANILHA.md)** — guia **para quem não conhece o assunto**: o que o Excel fazia, seus limites e como cada parte virou site.
👥 **[Gerenciamento de usuários](docs/USUARIOS.md)** — como criar contas, autorizar e remover acessos no Supabase.

## Como os dados são guardados

- **Modo local** (padrão, sem configuração): salva no navegador. Bom para testes e uso individual.
- **Banco compartilhado**: com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, usa o Supabase (plano gratuito) com login,
  regras de acesso por e-mail autorizado e registro de quem alterou cada dado.

## Rodar localmente

Requer Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testes
npm run build      # produção (pasta dist)
```

## Estrutura

```
src/
  data/planilha.json     Textos, listas, Lista Mestra, 217 unidades e auditorias extraídos da planilha
  data/planilha.ts       Acesso tipado a esses dados
  lib/calc.ts            Fórmulas da planilha (pesos, pontos, índices, dias restantes…)
  lib/backend/           Armazenamento: local (navegador) e Supabase
  lib/store.tsx          Estado da aplicação (atualizações imediatas + gravação)
  pages/                 Uma página por aba da planilha
  components/            Layout (cabeçalho, abas, rodapé), formulários, gráficos
  styles/global.css      Design system (azul #0F265C, verde #4FAF47, Poppins/Open Sans)
supabase/schema.sql      Tabelas e regras de segurança do banco
scripts/extrair_planilha.py   Gera src/data/planilha.json a partir do .xlsx
docs/                    Manual e guia de implantação
```

## Qualidade e testes

- `src/lib/calc.test.ts` confere os cálculos **item a item** contra a planilha original recalculada no LibreOffice
  (`src/lib/__fixtures__/referencia-planilha.json`): Dashboard, matriz por seção, distribuição por distrito, qualidade do cadastro,
  índices por item e por auditoria.
- `src/lib/backend/supabase.integracao.test.ts` valida o acesso ao banco contra um PostgREST/Supabase real (opcional; ver o guia de implantação).
- O `schema.sql` foi executado e testado em PostgreSQL 16 (regras de acesso, cascatas, IDs duplicados, bloqueio de usuários não autorizados).

## Atualizando os dados-base a partir da planilha

Se a planilha-fonte mudar (Lista Mestra, listas de opções, cadastro de unidades), regenere o arquivo de dados:

```bash
pip install openpyxl
npm run extrair -- "Instrumento_Controle_Documentacao_Escolar_CDE_SEMEC (4).xlsx"
```

Os textos são copiados exatamente como estão nas células. Para recarregar o banco com os novos dados-base, use
**Dados e planilhas → Restaurar dados originais** (apaga avaliações e ações — exporte o Excel antes).
Para apenas **atualizar** os dados com uma planilha nova, sem apagar nada, use **Dados e planilhas → Atualizar dados com uma planilha**.

🔭 Ideia para o futuro: [integração com o CME](docs/FUTURO_INTEGRACAO_CME.md) (coletar atos e vigências automaticamente).
