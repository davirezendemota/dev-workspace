# 017 MCP · servidor Python para Cursor

> **Última atualização:** 2026-08-18

---

## 1. Contexto e problema

O agent-cli no Cursor consome o Dev Workspace via REST (`curl` + skill `dev-workspace`).
MCP expõe **tools** nativas. Um **servidor MCP central** no DW atende **consumidores**
por repo: cada workspace Cursor envia o token scoped do `local_path`, sem um MCP por repo.

## 2. Objetivo

Servidor MCP único no compose; cada repo consumidor conecta com token de consumidor
(`Authorization` no MCP → proxy à API). Governança igual à API/skill.

## 3. Escopo

### Dentro do escopo

- `mcp-server/` — MCPServer, repassa `Authorization` do cliente à API DW
- Service `mcp` em `compose.yaml`, `compose.build.yaml`, `compose.production.yaml`
- Fallback admin opcional (`MCP_FALLBACK_TO_WORKSPACE_TOKEN`)
- `install-kit` gera `.cursor/mcp.json` com URL + consumer token; gitignore do arquivo
- `DEV_WORKSPACE_MCP_URL` em `.env.example` do install-kit

### Fora do escopo

- Auth no endpoint MCP (exposto em localhost no dev)
- Imagem publicada no GHCR (build local no compose por enquanto)
- Substituir skill nos consumidores — skill + MCP consumidor coexistem
- Escrita em milestones/tasks via agente (checkpoints e plans via MCP após aprovação)

## 4. Requisitos

### Funcionais

- **RF1:** Service `mcp` no compose (3011 dev, 8081 build, 3001 production), depende do app.
- **RF2:** Tools MCP retornam JSON formatado da API DW equivalente.
- **RF3:** MCP usa Bearer do cliente; API aplica scope de consumidor.
- **RF4:** `install.sh` instala/merge `.cursor/mcp.json` com consumer token.

### Não-funcionais

- **RNF1:** Python 3.12 slim, imagem dedicada em `mcp-server/Dockerfile`.
- **RNF2:** Timeout HTTP 120s para `ask` e geração de plano.

## 5. Fluxo / Comportamento esperado

1. `docker compose up` (ou `-f compose.build.yaml`) sobe `app` + `mcp`.
2. App gera/persiste `api_token` em `workspace_data/`.
3. MCP lê token e chama `http://app:3000/api/*` internamente.
4. Cursor conecta na URL `/mcp` da porta do stack e invoca tools.

## 6. Critérios de aceite

- **AC1:** `mcp-server/` contém servidor FastMCP, Dockerfile e README.
- **AC2:** `compose.yaml`, `compose.build.yaml` e `compose.production.yaml` incluem service `mcp`.
- **AC3:** Tools cobrem projects, spec-checklist, tasks, checkpoints, milestones, plans, ask, prompts, sync.
- **AC4:** `.env.example` e README documentam portas e consumidor MCP.
- **AC5:** MCP repassa `Authorization` do cliente à API; `install-kit` gera `.cursor/mcp.json` scoped (gitignored).
- **AC6:** MCP expõe `update_checkpoints`, `upsert_checkpoint`, `add_checkpoint_from_pdf`, `parse_pdf_transcript`; API `POST …/checkpoints/parse-pdf`.

## 7. Decisões e alternativas consideradas

| Decisão | Alternativas descartadas | Motivo |
|---------|--------------------------|--------|
| Streamable HTTP (porta por stack) | STDIO no container | Cursor remoto precisa de URL |
| Proxy REST existente | Reimplementar lógica no Python | Uma fonte de verdade na API Next |
| Token via volume compartilhado | Duplicar geração no MCP | Mesmo token do app, sem sync manual |

## 8. Riscos e questões em aberto

- MCP sem auth na borda — aceitável em dev local; produção pode exigir proxy/TLS.
- Ordem de startup: MCP pode falcar se `api_token` ainda não existe (primeiro boot).
