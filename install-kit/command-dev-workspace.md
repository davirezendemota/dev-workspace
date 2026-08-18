# /dev-workspace

Consumir o Dev Workspace via **MCP** (preferido) ou API, usando a skill `.cursor/skills/dev-workspace/SKILL.md`.

## Regras

1. `source .dev-workspace/.env` — exige `DEV_WORKSPACE_URL` + `DEV_WORKSPACE_API_TOKEN` (consumidor).
2. **Preferir tools MCP** `dev-workspace` (`.cursor/mcp.json`) — `list_projects`, `get_checkpoints`, `add_checkpoint_from_pdf`, etc.
3. Fallback API: **não** ler `workspace_data/` — só `curl` se MCP indisponível.
4. Resolver o project id deste repo quando o pedido for sobre **este** projeto (`list_projects` / `GET /api/projects`).
5. Formatar respostas conforme a skill (diagrama ASCII para listas; importar → gravar arquivo).
6. **Plano aprovado** → `update_plans` (MCP) ou `PUT /api/projects/{id}/plans` com **`id` único**.
7. **Checkpoint / PDF reunião** → `add_checkpoint_from_pdf` ou `upsert_checkpoint` após aprovação; opcional `generate_checkpoint_summary`.
8. **Tasks:** somente leitura — nunca `PUT` tasks.

Pedido: `$ARGUMENTS`

## Interpretação

| Pedido | Ação |
|--------|------|
| Vazio | Checkpoints deste repo (MCP `get_checkpoints` ou API) |
| `milestones` / `roadmap` | Milestones |
| `plans` / `plano` / `P001` | Planos de ação |
| `features` / `specs` | Features do checklist |
| `tasks` / `tarefas` | Tasks (somente leitura) |
| `projects` / `projetos` | Projetos deste repo no DW |
| `pendências` / `checklist` | ACs pendentes |
| PDF / transcrição / reunião | `parse_pdf_transcript` → aprovar → `add_checkpoint_from_pdf` |
| `importar …` / `import …` | Prompt da API → `.cursor/commands/{id}.md` |
| Outros | Seguir skill (resumo, ask, …) |

Exemplos:

- `/dev-workspace importar o prompt gsync main`
- `/dev-workspace checkpoints`
- `/dev-workspace milestones`
- `/dev-workspace plans`
- `/dev-workspace features`
- `/dev-workspace tasks`
- `/dev-workspace projects`
