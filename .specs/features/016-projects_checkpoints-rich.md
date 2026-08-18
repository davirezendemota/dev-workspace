# 016 Projects · Checkpoints com atas e descrição markdown

> **Última atualização:** 2026-08-18

---

## 1. Contexto e problema

Checkpoints hoje guardam apenas data, título e resumo curto gerado por IA. Reuniões
com stakeholders geram atas e notas longas em markdown que não cabem no resumo de duas
frases exibido na timeline.

## 2. Objetivo

O usuário armazena descrição ilimitada em markdown e múltiplas atas por checkpoint, e
abre um painel lateral com o conteúdo completo a partir da aba Checkpoints do modal de
projeto.

## 3. Escopo

### Dentro do escopo
- Campos `description` (markdown, sem limite) e `atas` (array `{ title?, content }`) no JSON
- Campo `date` no formato canônico `DD/MM/YYYY HH:mm` (campo `time` legado é absorvido na normalização)
- Normalização/serialização retrocompatível com checkpoints legados (`summary` preservado)
- Botão expandir ao lado de “Gerar resumo” abre sidebar à direita com título, atas e descrição renderizada
- Resumo IA (`summary`) continua na timeline como preview curto
- `POST /api/projects/{id}/checkpoints/parse-pdf` — extrai texto de PDF (transcrição)
- Agentes: criar/alterar checkpoints via MCP após aprovação (spec 017 + skill)

### Fora do escopo
- Editor in-app de checkpoints/atas (JSON / MCP após aprovação)
- Armazenar PDF binário no DW (só texto extraído em `atas`)
- Vínculo formal ata ↔ milestone

## 4. Requisitos

### Funcionais
- **RF1:** Checkpoint usa `date` em `DD/MM/YYYY HH:mm`; `description` (markdown) e `atas` (array de objetos com `title` e `content`).
- **RF2:** API GET/PUT de checkpoints persiste os novos campos sem truncar `description`.
- **RF3:** Na timeline, o resumo curto (`summary`) permanece visível; descrição completa só no painel expandido.
- **RF4:** Botão expandir abre sidebar à direita com título, lista de atas em coluna e descrição em markdown.
- **RF5:** Checkpoints legados sem `description` exibem `summary` como fallback no painel expandido.

### Não-funcionais
- **RNF1:** Retrocompatível — projetos existentes sem os novos campos continuam funcionando.

## 5. Fluxo / Comportamento esperado

1. Usuário edita `checkpoints` no JSON com `description` e/ou `atas`.
2. Na aba Checkpoints, cada item mostra título e resumo IA na timeline.
3. Ao clicar em expandir, abre sidebar com conteúdo completo formatado.
4. Escape ou clique no backdrop fecha o sidebar.

## 6. Critérios de aceite

- **AC1:** Dado checkpoint com `description` markdown, quando o usuário expande, então a descrição é renderizada com formatação markdown.
- **AC2:** Dado checkpoint com array `atas`, quando o usuário expande, então cada ata aparece em coluna com título e conteúdo.
- **AC3:** Dado checkpoint legado só com `summary`, quando o usuário expande, então o painel exibe o resumo como descrição.
- **AC4:** Dado PUT com `description` longa e `atas`, quando a API responde, então os dados são persistidos integralmente no JSON.

## 7. Modelo de dados (exemplo)

```json
{
  "date": "12/08/2026 18:00",
  "title": "Kickoff com cliente",
  "summary": "Alinhamento de escopo e cronograma.",
  "description": "## Entregas\n\n- Spec 012 aprovada\n- **Próximo passo:** milestones",
  "atas": [
    {
      "title": "Reunião kickoff",
      "content": "Participantes: time + cliente.\n\nDecisões registradas em bullet points."
    }
  ],
  "summaryUpdatedAt": "2026-08-12T18:00:00.000Z"
}
```

## 8. Notas técnicas

- Tipos e normalização em `app/lib/checkpoints.ts`.
- UI em `ProjectCheckpoints.tsx` com componente de sidebar e `Markdown` existente.
- Contexto de geração de resumo IA inclui `description` e títulos das atas quando presentes.
