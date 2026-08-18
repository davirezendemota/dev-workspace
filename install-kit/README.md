# install-kit

Instala `.dev-workspace/.env`, skill `dev-workspace`, comando `/dev-workspace` e **consumidor MCP** (`.cursor/mcp.json`).

```bash
./install-kit/install.sh /path/to/consumer \
  --api-url http://localhost:3010 \
  --api-token "<consumer_api_token>" \
  --dw-root /path/to/dev-workspace
```

Token consumidor: `GET /api/projects/{id}/connection` na UI DW (admin), ou logs do container só para admin global.

## MCP (consumidor por repo)

- Servidor MCP **único** no DW (`http://localhost:3011/mcp` em dev).
- `install.sh` gera `.cursor/mcp.json` com token scoped ao `local_path` do repo.
- Cursor recarrega MCP → tools `list_projects`, `get_checkpoints`, `add_checkpoint_from_pdf`, etc.

## Testar (via IA)

Na raiz do consumidor, com DW + MCP rodando:

```bash
cd /path/to/consumer
cursor agent --print --trust "/dev-workspace checkpoints"
```

Ou no chat do Cursor (com MCP conectado): pedir pendências, checkpoints, ou criar checkpoint de PDF.

**Preferir MCP** — fallback `curl` só se MCP offline.

Importar prompt:

```bash
cursor agent --print --trust "/dev-workspace importar o prompt gsync main"
```

Grava `.cursor/commands/{id}.md` e `.dev-workspace/imported-prompts.json`.

Tudo sobre MCP, API, pendências e planejamento está na skill — sem bootstrap manual.
