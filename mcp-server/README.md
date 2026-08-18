# Dev Workspace MCP Server

Servidor [MCP](https://modelcontextprotocol.io/) central para o Cursor consumir o Dev Workspace via **tools**.

## Consumidor por repo (governança)

- **Um servidor MCP** no DW (este container).
- **Um consumidor por repo** no Cursor: cada workspace envia `Authorization: Bearer <consumer_token>` (o mesmo de `.dev-workspace/.env`).
- O MCP **repassa** o Bearer à API REST; o scope é definido pela API (`consumer_api_tokens.json` + `local_path`).

Sem header de consumidor, o servidor pode usar fallback admin (`WORKSPACE_API_TOKEN` ou `api_token`) se `MCP_FALLBACK_TO_WORKSPACE_TOKEN=true` (default).

## Transporte

Streamable HTTP em `http://localhost:3011/mcp` (dev) ou `http://localhost:8082/mcp` (build).

## Configuração no repo consumidor

O `install-kit/install.sh` gera `.cursor/mcp.json` com URL + token scoped. Manual:

```json
{
  "mcpServers": {
    "dev-workspace": {
      "url": "http://localhost:3011/mcp",
      "headers": {
        "Authorization": "Bearer <DEV_WORKSPACE_API_TOKEN>"
      }
    }
  }
}
```

## Tools

| Tool | API equivalente |
|------|-----------------|
| `list_projects` | `GET /api/projects` |
| `get_project` | `GET /api/projects/{id}` |
| `get_spec_checklist` | spec-checklist |
| `get_tasks` | tasks |
| `get_checkpoints` | checkpoints (GET) |
| `update_checkpoints` | PUT lista completa |
| `upsert_checkpoint` | criar/alterar um marco |
| `parse_pdf_transcript` | extrair texto do PDF (base64) |
| `parse_checkpoint_pdf` | PDF via API DW |
| `add_checkpoint_from_pdf` | PDF → checkpoint (prepend) |
| `generate_checkpoint_summary` | resumo IA do marco |
| `get_milestones` | milestones |
| `get_plans` / `update_plans` / `generate_plan` | plans |
| `get_feature` | features |
| `get_spec_graph` | spec-graph |
| `regenerate_ai_summary` | ai-summary |
| `ask_projects` | projects/ask |
| `list_prompts` / `get_prompt` | prompts |
| `sync_project` | sync |
| `get_connection` | connection (admin only) |

## Variáveis

| Variável | Padrão | Uso |
|----------|--------|-----|
| `DEV_WORKSPACE_URL` | `http://localhost:3010` | Base da API DW |
| `WORKSPACE_API_TOKEN` | — | Fallback admin (opcional) |
| `WORKSPACE_CONFIG_PATH` | `/data/config.json` | Deriva path do `api_token` |
| `MCP_FALLBACK_TO_WORKSPACE_TOKEN` | `true` | Lê `api_token` se sem Bearer do cliente |
| `MCP_HOST` | `0.0.0.0` | Bind HTTP |
| `MCP_PORT` | `8000` | Porta interna do container |

## Local (sem Docker)

```bash
cd mcp-server
pip install .
export DEV_WORKSPACE_URL=http://localhost:3010
export DEV_WORKSPACE_API_TOKEN=<consumer ou admin>
python -m dev_workspace_mcp
```

Teste com Bearer de consumidor:

```bash
curl -s -X POST http://localhost:3011/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $DEV_WORKSPACE_API_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize",...}'
```
