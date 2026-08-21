# 018 Projects · Views Calendário e Timeline

> **Última atualização:** 2026-08-21

---

## 1. Contexto e problema

A aba Projects lista projetos em Kanban (cards) e Tabela. Os checkpoints ficam
escondidos dentro de cada projeto; o usuário não consegue ver, no mesmo olhar,
quando as reuniões e marcos de vários projetos acontecem.

## 2. Objetivo

O usuário alterna para **Calendário** ou **Timeline** na aba Projects e vê os
checkpoints de todos os projetos visíveis (já filtrados/buscados), podendo abrir
o projeto a partir de um checkpoint.

## 3. Escopo

### Dentro do escopo
- Dois novos modos no toggle de view da aba Projects: Calendário e Timeline
- Fonte de dados: `checkpoints` já carregados em cada projeto (`GET /api/projects`)
- Calendário mensal (semana começa na segunda) com checkpoints no dia da `date`
- Timeline única, cruzando projetos, ordenada do mais recente ao mais antigo
- Clique no checkpoint abre o modal do projeto na aba Checkpoints, expandindo o item
- Filtros, busca e filtro por repositório da aba Projects aplicam-se às duas views
- Checkpoints sem data resolvida aparecem na Timeline (grupo “Sem data”) e como
  contagem no Calendário, não em um dia do grid

### Fora do escopo
- Criar/editar checkpoints pela view (continua JSON / MCP / aba Checkpoints)
- Drag-and-drop de checkpoints entre dias
- Persistência do modo de view (URL ou localStorage)
- Agrupar por repositório nessas views (permanece só na Tabela)
- Recorrência, all-day vs timed, timezone explícito além do `date` canônico

## 4. Requisitos

### Funcionais
- **RF1:** O toggle de view da aba Projects inclui Kanban, Tabela, Calendário e Timeline.
- **RF2:** Calendário renderiza um mês com navegação anterior/próximo e atalho para o mês atual.
- **RF3:** Cada checkpoint com `date` resolvida aparece no dia correspondente; o chip mostra projeto e título (ou resumo).
- **RF4:** Timeline lista checkpoints de todos os projetos visíveis, agrupados por dia, mais recente primeiro.
- **RF5:** Clique em um checkpoint abre `ProjectDetailModal` na aba Checkpoints com o painel do item expandido.
- **RF6:** Busca, filtro de cliente e filtro de repositório da aba Projects reduzem o conjunto exibido.
- **RF7:** Estados vazios: nenhum projeto; projetos sem checkpoints; dia sem eventos; checkpoints sem data.

### Não-funcionais
- **RNF1:** Views usam os checkpoints já presentes no card do projeto — sem endpoint extra.
- **RNF2:** Cores por repositório reutilizam o hue dos badges existentes.
- **RNF3:** Layout e tipografia seguem o tema atual (Classic/GitHub, claro/escuro).

## 5. Fluxo / Comportamento esperado

1. Usuário abre a aba Projects (lista já filtrada).
2. Escolhe Calendário: vê o mês do checkpoint mais recente (ou o mês atual se não houver datas) e chips nos dias.
3. Clica um dia para ver a lista completa daquele dia; clica um checkpoint para abrir o modal do projeto.
4. Escolhe Timeline: vê uma linha do tempo cruzando projetos, agrupada por data.
5. Checkpoints sem data ficam no final da Timeline; no Calendário, um aviso informa a quantidade.

## 6. Critérios de aceite

- **AC1:** Dado a aba Projects, quando o usuário aciona Calendário ou Timeline no toggle, então a listagem Kanban/Tabela é substituída pela view correspondente.
- **AC2:** Dado projetos com checkpoints datados, quando a view Calendário está ativa, então cada checkpoint aparece no dia da `date` resolvida (formato canônico `DD/MM/YYYY`).
- **AC3:** Dado os mesmos projetos, quando a view Timeline está ativa, então os checkpoints aparecem em ordem cronológica inversa, agrupados por dia, com nome do projeto.
- **AC4:** Dado um checkpoint visível no Calendário ou na Timeline, quando o usuário clica nele, então o modal do projeto abre na aba Checkpoints com aquele item expandido.
- **AC5:** Dado busca ou filtro de cliente/repositório, quando o conjunto de projetos muda, então Calendário e Timeline exibem somente checkpoints dos projetos visíveis.
- **AC6:** Dado projetos sem checkpoints datados, quando o usuário abre Calendário ou Timeline, então a UI mostra estado vazio (e, se houver itens sem data, o grupo/aviso correspondente).

## 7. Decisões e alternativas consideradas

| Decisão | Alternativas descartadas | Motivo |
|---------|--------------------------|--------|
| Views na aba Projects, não no modal | Calendário só por projeto | A dor é ver vários projetos no tempo |
| Reusar checkpoints do GET /api/projects | Endpoint agregado | Evita round-trip; dados já estão no card |
| Semana começa na segunda | Domingo (en-US) | Locale pt-BR |

## 8. Riscos e questões em aberto

- Checkpoints legados sem `date` herdam a data do item acima na lista (mesma regra da aba Checkpoints); itens que continuam sem data não entram no grid.
- Índice do checkpoint no JSON precisa permanecer estável entre a listagem e o modal para expandir o item certo.
