# 003 Projects

> **Última atualização:** 2026-07-25

---

## 1. Contexto e problema

O dashboard precisa listar e cadastrar projetos reais, não mocks. Cada projeto
é um arquivo JSON na pasta configurada em Settings. Sem uma fonte única em
disco, o app não consegue compartilhar estado entre host/Docker nem sincronizar
conteúdo remoto do GitHub de forma previsível.

## 2. Objetivo

O usuário lista projetos a partir dos `*.json` em `projects/`, cria projetos em
três modos — **Manual** (sem repositório), **Manual · repo** (referência a um
repositório local) ou **GitHub** (sincronizado) — e o sistema grava/atualiza os
arquivos na raiz dessa pasta.

## 3. Escopo

### Dentro do escopo
- Listagem na aba Projects lendo arquivos de projeto `*.json` na pasta de projects (Settings), excluindo sidecars `*.spec-checklist.json`
- Modal “Adicionar projeto” com modos **Manual**, **Manual · repo** e **GitHub**
- Manual: campo `nome` obrigatório; `client` opcional (sem repositório) → gera `{slug}.json`
- Manual · repo: campos `nome` (obrigatório), `client` (opcional) e `local_path` (pasta do repo local) → gera `{slug}.json` com `_meta.local_path`
- GitHub: link do repo, PAT, branch, caminho do arquivo → fetch + grava local
- Arquivos sempre na raiz de `projects/` (sem subpastas)
- API `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/{id}`, `POST /api/projects/{id}/sync`
- Cards alimentados pelo conteúdo do JSON (`name`, `repo`, `client`, etc.)
- Volume Docker: `./workspace_data` → `/data` (projects em `/data/projects`)

### Fora do escopo
- Edição completa do JSON pela UI (checkpoints, tip de IA)
- Checklist editável de projetos Manual (especificado em 008-projects_local-checklist)
- Auth / autorização nos endpoints
- Mover arquivos ao trocar `projects_folder`
- Subpastas por projeto (`slug/project.json`)
- Persistência de projetos no Postgres como fonte da verdade
- UI de re-sync periódica / cron

## 4. Requisitos

### Funcionais
- **RF1:** Listar projetos a partir dos arquivos de projeto `*.json` na raiz da pasta configurada, excluindo sidecars `*.spec-checklist.json`.
- **RF2:** Criar projeto Manual com `name` (obrigatório) e `client` (opcional), sem repositório.
- **RF3:** Criar projeto Manual · repo com `name` (obrigatório), `client` (opcional) e `local_path` (pasta local do repositório); gravar `_meta.local_path`.
- **RF4:** Ao criar Manual ou Manual · repo, gravar `{slug}.json` na raiz de `projects/` (slug a partir do name).
- **RF5:** Criar projeto GitHub com repo URL, PAT, branch e caminho do arquivo; fazer fetch e gravar `{slug}.json` local.
- **RF6:** O nome exibido vem do campo `name` do JSON (não de um campo separado de cadastro além do Manual).
- **RF7:** `id` do projeto = stem do arquivo (`acme-api` para `acme-api.json`).
- **RF8:** PAT nunca é retornado na API; apenas `has_github_pat`.
- **RF9:** Conflito 409 se já existir `{slug}.json`.

### Não-funcionais
- **RNF1:** Fonte da verdade = filesystem (`projects/*.json`), não o banco.
- **RNF2:** Meta de origem (`_meta.source_type`, credenciais GitHub) no próprio arquivo; `_meta` não aparece em `json_data` público.
- **RNF3:** Pasta padrão Docker `/data/projects` (host `./workspace_data/projects`).

## 5. Fluxo / Comportamento esperado

### Listagem
1. Usuário abre a aba Projects.
2. Frontend chama `GET /api/projects`.
3. API Route lê `*.json` em `projects_folder` e retorna a lista.
4. Cards renderizam os campos do JSON; lista vazia se não houver arquivos.

### Criação Manual
1. Usuário clica em “+” → modo Manual.
2. Preenche nome (client opcional).
3. `POST /api/projects` com `source_type: "local"` e `json_content`.
4. API Route gera `{slug}.json` na raiz e responde o projeto criado.
5. UI atualiza a lista e fecha o modal.

### Criação Manual · repo
1. Usuário escolhe modo Manual · repo.
2. Preenche nome, caminho local do repositório (`local_path`) e, se quiser, client.
3. `POST /api/projects` com `source_type: "local_repo"`, `json_content` e `local_path`.
4. API Route grava `{slug}.json` com `_meta.local_path` e responde o projeto criado.
5. UI atualiza a lista e fecha o modal.

### Criação GitHub
1. Usuário escolhe modo GitHub.
2. Informa repo, PAT, branch e caminho do arquivo.
3. API Route faz fetch via Contents API, exige `name` no JSON remoto, grava local.
4. Sucesso: arquivo em `projects/{slug}.json` + card na lista.
5. Erro (PAT, 404, JSON inválido): mensagem clara + toast.

**Estados:** loading na listagem; submitting no modal; vazio sem cards (só o “+”); erro com banner/`role="alert"`.

## 6. Critérios de aceite

- **AC1:** Dado arquivos `*.json` na pasta de projects, quando o usuário abre Projects, então os cards correspondem a esses arquivos.
- **AC2:** Dado nome válido no modo Manual (client opcional), quando o usuário cria, então surge `{slug}.json` na raiz de `projects/` sem `repo` nem `local_path`.
- **AC3:** Dado nome e `local_path` válidos no modo Manual · repo (client opcional), quando o usuário cria, então o projeto é gravado com `_meta.source_type: "local_repo"` e `_meta.local_path`.
- **AC4:** Dado configuração GitHub válida e JSON remoto com `name`, quando o usuário sincroniza, então o arquivo local é criado/atualizado e o projeto aparece na lista.
- **AC5:** Dado slug já existente, quando o usuário tenta criar de novo, então a API retorna 409.
- **AC6:** Dado projeto GitHub salvo, quando a API responde, então o PAT não é exposto (`has_github_pat` apenas).
- **AC7:** Dado o modal de adicionar projeto, quando o usuário abre, então os três modos Manual, Manual · repo e GitHub estão disponíveis.

## 7. Decisões e alternativas consideradas

| Decisão | Alternativas descartadas | Motivo |
|---------|--------------------------|--------|
| JSON na raiz `projects/{slug}.json` | Subpasta `projects/{slug}/project.json` | Mais simples de listar e versionar |
| Filesystem como fonte da verdade | Tabela `project` no Postgres | Alinha ao modelo “workspace em disco” + volume Docker |
| API Routes do Next.js (`/api/*`) | Backend FastAPI separado | App fullstack na raiz do repositório |
| Três modos no mesmo modal (Manual / Manual · repo / GitHub) | Telas separadas | Fluxo único de “adicionar” com origens distintas |
| `_meta` no arquivo para sync GitHub | Só banco para metadados | Mantém arquivo auto-contido; PAT fica no backend |

## 8. Riscos e questões em aberto

- Edição in-app de checkpoints/`ai` tip ainda não especificada; checklist local de projetos Manual está na spec 008.
- Rotação/criptografia do PAT em `_meta`.
- Auth nos endpoints `/api/projects` em produção.
- Comportamento ao renomear (`name` muda → slug/arquivo não renomeia automaticamente?).

**Formato do arquivo (exemplo):**

```json
{
  "name": "Acme API",
  "client": "Acme",
  "ai": "",
  "topDate": "—",
  "checkpoints": [],
  "checklist": [],
  "lastInteractionDays": 0,
  "openDemands": 0,
  "_meta": {
    "source_type": "local"
  }
}
```

**API:**

- `GET /api/projects` → lista a partir dos `*.json`
- `POST /api/projects` → `{ source_type: "local"|"local_repo"|"github", json_content?, local_path?, github_*? }`
- `GET|PUT|DELETE /api/projects/{id}` → `id` = slug do arquivo
- `POST /api/projects/{id}/sync` → re-fetch GitHub e sobrescreve o JSON local
