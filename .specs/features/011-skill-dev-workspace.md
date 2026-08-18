# 011 Install-kit · skill-dev-workspace

> **Última atualização:** 2026-08-18

---

## 1. Contexto e problema

Repos de produto usam `.specs/` genérico para requisitos e checklist. O Dev Workspace
lê esses arquivos e oferece UI, resumo de IA, tasks e integrações. O agent-cli precisa
de um caminho **simples** para consumir o DW (planejamento, pendências) via MCP ou API,
sem dezenas de arquivos de bootstrap no consumidor.

## 2. Objetivo

O `install-kit/` instala em qualquer repo consumidor **`.dev-workspace/.env`**, **consumidor MCP**
(`.cursor/mcp.json`) e **skill `dev-workspace`**, copiada de `skill-dev-workspace.md`.

## 3. Escopo

### Dentro do escopo

**Repo canônico (`dev-workspace`)**

- `install-kit/install.sh` — instala `.env`, `mcp.json`, skill (Cursor + Claude)
- `install-kit/skill-dev-workspace.md` — prompt único da skill (fonte de verdade)
- `install-kit/command-dev-workspace.md` — comando `/dev-workspace`
- `install-kit/mcp.json.example`, `.env.example`
- Servidor MCP central (spec 017) + API REST com Bearer token
- README com comando de instalação

**Repo consumidor (após `install.sh`)**

- `.dev-workspace/.env` — conexão (`ROOT` ou `URL` + token consumidor + `MCP_URL`)
- `.cursor/mcp.json` — consumidor scoped (gitignored)
- `.cursor/skills/dev-workspace/SKILL.md`, `.claude/skills/dev-workspace/SKILL.md`

**Skill `dev-workspace`**

- Preferir MCP; fallback API (`curl`)
- Lê `.dev-workspace/.env`
- Resolve projetos DW por `local_path` = raiz do repo
- Pendências, tasks, checkpoints (incl. PDF), milestones, plans, resumo IA, `ask`
- Diferencia uso vs `.specs/`

### Fora do escopo

- `projects.json` ou outro manifesto de projetos no consumidor
- Pasta `templates/`, rules, bootstrap manual no consumidor
- Instalar `.dev-workspace/` na raiz do repo `dev-workspace` (exceto testes locais)
- Substituir o kit `.specs/` nos repos de produto

## 4. Requisitos

### Funcionais

- **RF1:** `install.sh` copia `skill-dev-workspace.md` → skills Cursor e Claude.
- **RF2:** `install.sh` cria ou preserva ( `--merge`) `.dev-workspace/.env`.
- **RF3:** Skill documenta MCP (consumidor), API, endpoints e distinção vs `.specs/`.
- **RF4:** `install.sh` gera `.cursor/mcp.json` com token consumidor e `DEV_WORKSPACE_MCP_URL`.
- **RF5:** Container DW gera `DEV_WORKSPACE_API_TOKEN` no startup e exibe nos logs.
- **RF6:** API externa exige `Authorization: Bearer <token>`; UI same-origin sem token.
- **RF7:** Um repo consumidor pode mapear a vários projetos DW (filtro `local_path`).

### Não-funcionais

- **RNF1:** Consumidor: máximo ~5 arquivos bridge (`.env`, example, `install.sh`, 2× SKILL).
- **RNF2:** `install.sh` funciona local (`install-kit/`) e remoto (`curl` da main).
- **RNF3:** `skill-dev-workspace.md` é a única fonte do prompt — sem duplicar em subpastas.

## 5. Fluxo / Comportamento esperado

### Instalação

1. Na raiz do consumidor: `./install-kit/install.sh . --dw-root /path/to/dev-workspace`.
2. Script cria `.dev-workspace/.env`, `.cursor/mcp.json` e skills em `.cursor/` e `.claude/`.
3. Usuário registra projeto no DW com `local_path` → consumidor; recarrega MCP no Cursor.

### Uso pelo agente

1. Usuário pede pendências, tasks, checkpoint de PDF ou resumo → skill `dev-workspace` + MCP.
2. Skill/MCP usam token consumidor; scope por `local_path`.
3. Autorar specs / editar ACs → fluxo `.specs/` (permitido em paralelo).

### Arquitetura de responsabilidades

| Camada | Função |
|--------|--------|
| `.specs/` no repo | Specs genéricas — ler/editar no repo |
| Dev Workspace | Lê `.specs` dos repos, UI + API + resumo IA + tasks |
| `skill-dev-workspace` | Consome DW via MCP (preferido) ou API |

## 6. Critérios de aceite

- **AC1:** Dado o repo canônico, quando inspecionado, então `install-kit/` contém `install.sh`, `.env.example` e `skill-dev-workspace.md` na raiz do kit (sem `templates/`).
- **AC2:** Dado um diretório temporário, quando `install.sh` roda, então existem `.dev-workspace/.env` e skills em `.cursor/skills/dev-workspace/` e `.claude/skills/dev-workspace/` copiadas de `skill-dev-workspace.md`.
- **AC3:** Dado `--merge`, quando `install.sh` roda com `.env` existente, então `.env` é preservado e a skill é atualizada.
- **AC4:** Dado o container DW ao iniciar, então `DEV_WORKSPACE_API_TOKEN` aparece nos logs.
- **AC5:** Dado `skill-dev-workspace.md`, quando lido, então cobre MCP consumidor, API, projetos e vs `.specs/`.
- **AC6:** Dado o README do repo canônico, quando lido, então há seção Bridge com instalação em um comando.

## 7. Decisões e alternativas consideradas

| Decisão | Alternativas descartadas | Motivo |
|---------|--------------------------|--------|
| Um arquivo `skill-dev-workspace.md` na raiz do kit | `templates/`, várias skills/commands | Menos arquivos no consumidor |
| `.env` só conexão; projetos no DW | `projects.json` no consumidor | Fonte de verdade no DW |
| Skill única | Rule + command + bootstrap doc | Um prompt, um lugar para manter |
| API + token no container | API aberta | Segurança para chamadas externas |

## 8. Riscos e questões em aberto

- Consumidor precisa copiar token dos logs ou configurar URL manualmente.
- Modo `local` (só `ROOT`) não cobre resumo IA / `ask` sem DW rodando.
- Spec checklist no consumidor e checklist via API DW podem divergir até sync — DW é a visão agregada para planejamento.
