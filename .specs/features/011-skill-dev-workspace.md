# 011 Install-kit · skill-dev-workspace

> **Última atualização:** 2026-07-30

---

## 1. Contexto e problema

Repos de produto usam `.specs/` genérico para requisitos e checklist. O Dev Workspace
lê esses arquivos e oferece UI, resumo de IA, tasks e integrações. O agent-cli precisa
de um caminho **simples** para consumir a API do DW (planejamento, pendências) sem
dezenas de arquivos de bootstrap no consumidor.

## 2. Objetivo

O `install-kit/` instala em qualquer repo consumidor **`.dev-workspace/.env`** + **skill
`dev-workspace`**, copiada de um único arquivo canônico `skill-dev-workspace.md`.

## 3. Escopo

### Dentro do escopo

**Repo canônico (`dev-workspace`)**

- `install-kit/install.sh` — instala `.env` + skill (Cursor + Claude)
- `install-kit/skill-dev-workspace.md` — prompt único da skill (fonte de verdade)
- `install-kit/.env.example`
- API REST com Bearer token (`WORKSPACE_API_TOKEN` no container, logs no startup)
- Middleware `/api/*` (same-origin UI exempt)
- README com comando de instalação

**Repo consumidor (após `install.sh`)**

- `.dev-workspace/.env` — conexão (`ROOT` ou `URL` + token)
- `.dev-workspace/.env.example`, `.dev-workspace/install.sh` (re-run `--merge`)
- `.cursor/skills/dev-workspace/SKILL.md`
- `.claude/skills/dev-workspace/SKILL.md`

**Skill `dev-workspace`**

- Lê `.dev-workspace/.env`
- Resolve projetos DW por `local_path` = raiz do repo (`GET /api/projects`)
- Pendências, tasks, checklist agregado, resumo IA, `ask` cross-project
- Diferencia uso vs `.specs/` (specs no repo; DW para planejamento consolidado)

### Fora do escopo

- `projects.json` ou outro manifesto de projetos no consumidor
- Pasta `templates/`, rules, commands, bootstrap manual no consumidor
- Instalar `.dev-workspace/` na raiz do repo `dev-workspace`
- Servidor MCP
- Substituir o kit `.specs/` nos repos de produto

## 4. Requisitos

### Funcionais

- **RF1:** `install.sh` copia `skill-dev-workspace.md` → skills Cursor e Claude.
- **RF2:** `install.sh` cria ou preserva ( `--merge`) `.dev-workspace/.env`.
- **RF3:** Skill documenta conexão, modos (local/api/auto), endpoints e setup curl.
- **RF4:** Container DW gera `DEV_WORKSPACE_API_TOKEN` no startup e exibe nos logs.
- **RF5:** API externa exige `Authorization: Bearer <token>`; UI same-origin sem token.
- **RF6:** Um repo consumidor pode mapear a vários projetos DW (filtro `local_path`).

### Não-funcionais

- **RNF1:** Consumidor: máximo ~5 arquivos bridge (`.env`, example, `install.sh`, 2× SKILL).
- **RNF2:** `install.sh` funciona local (`install-kit/`) e remoto (`curl` da main).
- **RNF3:** `skill-dev-workspace.md` é a única fonte do prompt — sem duplicar em subpastas.

## 5. Fluxo / Comportamento esperado

### Instalação

1. Na raiz do consumidor: `./install-kit/install.sh . --dw-root /path/to/dev-workspace`.
2. Script cria `.dev-workspace/.env` e instala skill em `.cursor/` e `.claude/`.
3. Usuário registra projeto no DW com `local_path` → consumidor.

### Uso pelo agente

1. Usuário pede pendências, tasks ou resumo → skill `dev-workspace` ativada.
2. Skill lê `.env`, resolve projeto(s), chama API DW.
3. Autorar specs / editar ACs → fluxo `.specs/` (permitido em paralelo).

### Arquitetura de responsabilidades

| Camada | Função |
|--------|--------|
| `.specs/` no repo | Specs genéricas — ler/editar no repo |
| Dev Workspace | Lê `.specs` dos repos, UI + API + resumo IA + tasks |
| `skill-dev-workspace` | Consome API DW para planejamento e pendências |

## 6. Critérios de aceite

- **AC1:** Dado o repo canônico, quando inspecionado, então `install-kit/` contém `install.sh`, `.env.example` e `skill-dev-workspace.md` na raiz do kit (sem `templates/`).
- **AC2:** Dado um diretório temporário, quando `install.sh` roda, então existem `.dev-workspace/.env` e skills em `.cursor/skills/dev-workspace/` e `.claude/skills/dev-workspace/` copiadas de `skill-dev-workspace.md`.
- **AC3:** Dado `--merge`, quando `install.sh` roda com `.env` existente, então `.env` é preservado e a skill é atualizada.
- **AC4:** Dado o container DW ao iniciar, então `DEV_WORKSPACE_API_TOKEN` aparece nos logs.
- **AC5:** Dado `skill-dev-workspace.md`, quando lido, então cobre conexão, resolução de projetos, endpoints API e distinção vs `.specs/`.
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
