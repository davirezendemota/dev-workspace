# 003 Projects

> **Última atualização:** 2026-07-30

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
- Listagem na aba Projects lendo arquivos de projeto `*.json` na pasta de projects (Settings), excluindo sidecars legados (`*.spec-checklist.json`, `*.tasks.json`, `*.checklist.json`)
- Modal “Adicionar projeto” com modos **Manual**, **Manual · repo** e **GitHub**
- Manual: campo `nome` obrigatório; `client` opcional (sem repositório) → gera `{slug}.json`
- Manual · repo: campos `nome` (obrigatório), `client` (opcional), `local_path` (pasta do repo local) e `local_repo_branch` (branch das specs, padrão `main`) → gera `{slug}.json` com `_meta.local_path` e `_meta.local_repo_branch` (detalhes em [[015-projects_local-repo-branch]])
- GitHub: link do repo, PAT, branch → grava JSON local; specs via `.specs/spec-checklist.json` no repositório
- Cards alimentados pelo conteúdo do JSON (`name`, `repo`, `client`, etc.); subtítulo do repo no formato `repo:branch` para `local_repo` e GitHub
- Arquivos sempre na raiz de `projects/` (sem subpastas)
- API `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/{id}`, `POST /api/projects/{id}/sync`
- Volume Docker: `./workspace_data` → `/data` (projects em `/data/projects`)

### Fora do escopo
- Edição completa do JSON pela UI (checkpoints, tip de IA)
- Tasks editáveis de projetos (especificado em 008-projects_tasks)
- Auth / autorização nos endpoints
- Mover arquivos ao trocar `projects_folder`
- Subpastas por projeto (`slug/project.json`)
- Persistência de projetos no Postgres como fonte da verdade
- UI de re-sync periódica / cron

## 4. Requisitos

### Funcionais
- **RF1:** Listar projetos a partir dos arquivos de projeto `*.json` na raiz da pasta configurada, excluindo sidecars legados (`*.spec-checklist.json`, `*.tasks.json`, `*.checklist.json`).
- **RF2:** Criar projeto Manual com `name` (obrigatório) e `client` (opcional), sem repositório.
- **RF3:** Criar projeto Manual · repo com `name` (obrigatório), `client` (opcional), `local_path` (pasta local do repositório) e `local_repo_branch` (opcional, default `main`); gravar `_meta.local_path` e `_meta.local_repo_branch`.
- **RF4:** Ao criar Manual ou Manual · repo, gravar `{slug}.json` na raiz de `projects/` (slug a partir do name).
- **RF5:** Criar projeto GitHub com repo URL, PAT, branch e `json_content` (name obrigatório); validar `.specs/spec-checklist.json` no repositório e gravar `{slug}.json` local.
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
2. Preenche nome, caminho local do repositório (`local_path`), branch das specs (`local_repo_branch`, padrão `main`) e, se quiser, client.
3. `POST /api/projects` com `source_type: "local_repo"`, `json_content`, `local_path` e `local_repo_branch`.
4. API Route grava `{slug}.json` com `_meta.local_path`, `_meta.local_repo_branch` e responde o projeto criado.
5. UI atualiza a lista e fecha o modal; card exibe subtítulo `repo:branch` (ex.: `erp-varejo:develop`).

### Criação GitHub
1. Usuário escolhe modo GitHub.
2. Informa nome, repo, PAT, branch e (opcional) `spec_project_id` / caminho do checklist.
3. API valida acesso ao `.specs/spec-checklist.json` remoto e grava `{slug}.json` local com `_meta` GitHub.
4. Sucesso: arquivo em `projects/{slug}.json` + card na lista; specs lidas do checklist remoto e resumo IA gerado (quando configurado).
5. Erro (PAT, 404, checklist ausente): mensagem clara + toast.

**Estados:** loading na listagem; submitting no modal; vazio sem cards (só o “+”); erro com banner/`role="alert"`.

## 6. Critérios de aceite

- **AC1:** Dado arquivos `*.json` na pasta de projects, quando o usuário abre Projects, então os cards correspondem a esses arquivos.
- **AC2:** Dado nome válido no modo Manual (client opcional), quando o usuário cria, então surge `{slug}.json` na raiz de `projects/` sem `repo` nem `local_path`.
- **AC3:** Dado nome, `local_path` e `local_repo_branch` válidos no modo Manual · repo (client opcional), quando o usuário cria, então o projeto é gravado com `_meta.source_type: "local_repo"`, `_meta.local_path` e `_meta.local_repo_branch`.
- **AC4:** Dado configuração GitHub válida e spec-checklist acessível, quando o usuário adiciona o projeto, então o arquivo local é criado com dados informados no formulário e specs vêm do checklist remoto.
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

**Formato do arquivo (exemplo Manual · repo):**

```json
{
  "name": "ERP Varejo - Análise de Crédito",
  "client": "—",
  "ai": "",
  "topDate": "—",
  "checkpoints": [],
  "tasks": [],
  "lastInteractionDays": 0,
  "openDemands": 0,
  "_meta": {
    "source_type": "local_repo",
    "local_path": "/home/user/workspace/erp-varejo",
    "local_repo_branch": "feat/analise-recuperacao-credito",
    "spec_project_id": "analise-credito",
    "spec_checklist_path": ".specs/spec-checklist.json"
  }
}
```

**Formato do arquivo (exemplo Manual):**

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

- `GET /api/projects` → lista a partir dos `*.json`; resposta inclui `local_repo_branch` e `local_repo_checked_out_branch` (somente leitura) para projetos `local_repo`
- `POST /api/projects` → `{ source_type: "local"|"local_repo"|"github", json_content?, local_path?, local_repo_branch?, github_*? }`
- `GET|PUT|DELETE /api/projects/{id}` → `id` = slug do arquivo
- `POST /api/projects/{id}/sync` → revalida spec-checklist no GitHub e atualiza `last_synced_at`
