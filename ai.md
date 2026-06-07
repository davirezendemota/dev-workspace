# AI Agents

Agentes de IA especializados por área de atuação. Cada agente está definido em `.ai-agents/` com identidade, stack, competências e estilo de trabalho próprios.

## Resumo

### Agentes genéricos (cross-stack)

| Agente | Arquivo | Foco |
|---|---|---|
| **Dev Fullstack** | [.ai-agents/dev-fullstack.md](.ai-agents/dev-fullstack.md) | Ciclo completo — do banco à interface. TypeScript, React, Node.js, PostgreSQL |
| **Dev Frontend** | [.ai-agents/dev-frontend.md](.ai-agents/dev-frontend.md) | Interfaces, performance, acessibilidade. React/Next.js, Tailwind, shadcn/ui |
| **Dev Backend** | [.ai-agents/dev-backend.md](.ai-agents/dev-backend.md) | APIs robustas e seguras. Node.js/Python/Go, PostgreSQL, Redis, mensageria |
| **DevOps / Docker** | [.ai-agents/devops-docker.md](.ai-agents/devops-docker.md) | Containerização, CI/CD, Portainer, GHCR. Docker Compose multi-ambiente, Watchtower, Nginx Proxy Manager |

### Agentes por tecnologia (baseados nos repositórios do workspace)

| Agente | Arquivo | Foco | Projetos |
|---|---|---|---|
| **Dev Fullstack Next.js** | [.ai-agents/dev-fullstack-nextjs.md](.ai-agents/dev-fullstack-nextjs.md) | Next.js 15 + FastAPI + PostgreSQL 18. shadcn/ui, Tailwind 4, i18next | `franquiaempada`, `vanessacrm_app`, `vexalabs_app`, `vexalabs_fullstack-template` |
| **Dev Backend FastAPI** | [.ai-agents/dev-backend-fastapi.md](.ai-agents/dev-backend-fastapi.md) | Python 3.12 + FastAPI + SQLModel + Alembic. Controller→Service→Repository | `franquiaempada`, `sistema-cobranca-monolith`, `vanessacrm_app`, `vanessacrm_chatbot`, `vexalabs_app`, `vexalabs_fullstack-template` |
| **Dev Fullstack PHP** | [.ai-agents/dev-fullstack-php.md](.ai-agents/dev-fullstack-php.md) | PHP 5.6 + CakePHP 2.x / MVC custom. Bootstrap, jQuery, MySQL 5.7 | `sistema-cobranca-monolith`, `sistema-gestao-monolith` |
| **Dev Backend PHP Legado** | [.ai-agents/dev-backend-legacy-php.md](.ai-agents/dev-backend-legacy-php.md) | PHP 5.6 sem framework. Classes custom, `mysql_*`, Apache 2.4 | `sistema-feb-monolith` |
| **DBA PostgreSQL** | [.ai-agents/dba-postgresql.md](.ai-agents/dba-postgresql.md) | PostgreSQL 18 + SQLModel + Alembic. Migrations, índices, soft delete | `franquiaempada`, `vanessacrm_app`, `vanessacrm_chatbot`, `vexalabs_app`, `vexalabs_fullstack-template` |
| **Dev Frontend Website Static** | [.ai-agents/dev-frontend-website-static.md](.ai-agents/dev-frontend-website-static.md) | Sites estáticos Next.js (static export, Nginx, Docker multi-stage) | `obliviongrowth_website` |
| **Dev Desktop Tauri** | [.ai-agents/dev-desktop-tauri.md](.ai-agents/dev-desktop-tauri.md) | Aplicações desktop nativas. Tauri 2 + Rust + React/TypeScript | `founders-brain` |
| **DBA MySQL** | [.ai-agents/dba-mysql.md](.ai-agents/dba-mysql.md) | MySQL 5.7 + PHP 5.6 legado. Multi-banco, latin1/utf8, PDO | `sistema-cobranca-monolith`, `sistema-feb-monolith`, `sistema-gestao-monolith` |

## Mapeamento projeto → agentes

Cada projeto do workspace e os agentes que o conhecem:

| Projeto | Stack principal | Agentes |
|---|---|---|
| `franquiaempada` | Next.js 15 + FastAPI + PostgreSQL 18 | `dev-fullstack-nextjs`, `dev-backend-fastapi`, `dba-postgresql`, `devops-docker` |
| `vanessacrm_app` | Next.js 15 (app + website) + FastAPI + PostgreSQL 18 + Qdrant | `dev-fullstack-nextjs`, `dev-backend-fastapi`, `dba-postgresql`, `devops-docker` |
| `vexalabs_app` | Next.js 15 (app + website) + FastAPI + PostgreSQL 18 | `dev-fullstack-nextjs`, `dev-backend-fastapi`, `dba-postgresql`, `devops-docker` |
| `vexalabs_fullstack-template` | Next.js 15 + FastAPI + PostgreSQL 18 (template base) | `dev-fullstack-nextjs`, `dev-backend-fastapi`, `dba-postgresql`, `devops-docker` |
| `sistema-cobranca-monolith` | CakePHP 2.x (PHP 5.6) + FastAPI + MySQL 5.7 | `dev-fullstack-php`, `dev-backend-fastapi`, `dba-mysql`, `devops-docker` |
| `sistema-gestao-monolith` | PHP 5.6 MVC custom + Bootstrap 4.5 + MySQL 5.7 | `dev-fullstack-php`, `dba-mysql`, `devops-docker` |
| `sistema-feb-monolith` | PHP 5.6 sem framework + MySQL 5.7 | `dev-backend-legacy-php`, `dba-mysql`, `devops-docker` |
| `vanessacrm_chatbot` | FastAPI + PostgreSQL 18 (backend only) | `dev-backend-fastapi`, `dba-postgresql`, `devops-docker` |
| `vexalabs_infra` | Stacks Portainer multi-ambiente (dev/staging/prod) | `devops-docker` |
| `vexalabs_vps` | Watchtower, Nginx Proxy Manager, Portainer, Dozzle, backup-routine | `devops-docker` |
| `ferreiraeborzone_apache-server` | Apache HTTPD + Docker + MySQL, serve PHP monoliths | `devops-docker`, `dev-fullstack-php` |
| `founders-brain` | Tauri 2 + Rust + React/TypeScript (desktop) | `dev-desktop-tauri` |
| `ia_lopesrio` | — | — |
| `obliviongrowth_infra` | Portainer stacks (dev/staging) para deploy de website | `devops-docker` |
| `obliviongrowth_website` | Next.js 15 (static export) + Tailwind + i18next + Nginx | `dev-fullstack-nextjs`, `dev-frontend-website-static`, `devops-docker` |

## Fluxo de trabalho típico

### Stack moderno (Next.js + FastAPI + PostgreSQL)

```
Dev Backend FastAPI           Dev Fullstack Next.js        DevOps/Docker
       │                              │                        │
       ├─ SQLModel/Alembic ───────────┤                        │
       ├─ Endpoints REST ─────────────┤                        │
       │                              ├─ shadcn/ui/Tailwind ───┤
       │                              ├─ i18next/I18n ─────────┤
       │                              │                        ├─ Docker Compose
       │                              │                        ├─ GHCR
       └──────────────────────────────┴────────────────────────┤
                                                               └─ Portainer Deploy
                              ▲
                      DBA PostgreSQL
                   (schema, migrations)
```

### Stack legado (PHP 5.6 + MySQL 5.7)

```
Dev Backend PHP Legado      Dev Fullstack PHP         DBA MySQL          DevOps/Docker
       │                         │                       │                     │
       ├─ Classes custom ────────┤                       │                     │
       ├─ mysql_* / PDO ─────────┼───────────────────────┤                     │
       │                         ├─ CakePHP/MVC ─────────┤                     │
       │                         ├─ Bootstrap/jQuery ────┤                     ├─ Docker Compose
       │                         │                       ├─ 3-4 bancos         ├─ GHCR
       └─────────────────────────┴───────────────────────┤                     └─ Portainer
                                                         └─ latin1/utf8
```

## Quando usar cada agente

### Genéricos (qualquer projeto)

#### Dev Fullstack
- Funcionalidades que envolvem frontend e backend
- Planejamento de features ponta a ponta
- CRUDs completos com interface e API
- Debugging cross-stack

#### Dev Frontend
- Criação ou refatoração de componentes
- Estilização e design system
- Otimização de performance e bundle
- Implementação de layouts responsivos
- Testes de interface e acessibilidade

#### Dev Backend
- Design e implementação de APIs
- Modelagem de banco de dados
- Otimização de queries e índices
- Autenticação e autorização
- Filas e processamento assíncrono

#### DevOps / Docker
- Criação de Dockerfiles e docker-compose para dev local e produção
- Stacks Portainer multi-ambiente (development/staging/production) com profiles
- CI/CD com GitHub Actions + GHCR (rmconsult-io, ferreiraeborzone, vexalabs-tech, obliviongrowth)
- Deploy e orquestração via Portainer + Nginx Proxy Manager
- Infra compartilhada: Watchtower (auto-update + Discord), backup-routine, Dozzle
- Troubleshooting de infraestrutura e debugging de containers
- Mapeamento de portas (range 10000-10004 para dev local)

#### Dev Desktop Tauri
- `founders-brain` — Second Brain desktop app
- Aplicações desktop nativas multiplataforma com Tauri 2
- Desenvolvimento Rust (comandos, state management, plugins)
- Frontend React 19 + Vite + Tailwind para a camada UI
- IPC e eventos entre frontend e backend Rust
- Build, CI/CD e distribuição de binários desktop

### Por tecnologia (projetos específicos)

#### Dev Fullstack Next.js
- `franquiaempada` — Franquias, pedidos, entregas. i18n pt-BR, RBAC, relatórios com jspdf
- `vanessacrm_app` — CRM multi-tenant. 2 frontends (app + website), Tiptap, Qdrant
- `vexalabs_app` — Project/client management. Tiptap editor, 22 migrations, custom roles
- `vexalabs_fullstack-template` — Template base para novos projetos fullstack
- Páginas Next.js 15 (App Router, standalone output), Server vs Client Components
- Componentes shadcn/ui (base-nova), Tailwind CSS 4, tw-animate-css
- Formulários com react-hook-form + zod, notificações com sonner
- Internacionalização i18next com detecção de idioma e lazy loading
- Tiptap rich text editor com extensões (links, imagens, tasks)

#### Dev Backend FastAPI
- `franquiaempada` — CRUDs, JWT + RBAC, cron jobs, relatórios PDF
- `sistema-cobranca-monolith` — Integração ProJuris, relatórios WeasyPrint, APScheduler diário/mensal
- `vanessacrm_app` — Webhooks Chatwoot, OpenAI embeddings, Google Drive/Sheets, Qdrant
- `vanessacrm_chatbot` — Chatbot backend puro, API de mensageria
- `vexalabs_app` — 22 migrations, RBAC com custom roles, project/client management
- `vexalabs_fullstack-template` — Template base, soft delete, BaseRepository genérico
- APIs REST com FastAPI, autenticação JWT (access + refresh tokens)
- Modelagem com SQLModel, migrations Alembic (`upgrade head` automático)
- APScheduler para jobs agendados (health checks, sincronizações)
- Integrações externas via httpx (APIs bancárias, webhooks, catálogos)
- Relatórios PDF com WeasyPrint + Jinja2 (cobranca-monolith)

#### Dev Fullstack PHP
- `sistema-cobranca-monolith` — CakePHP 2.x + API FastAPI auxiliar. 4 bancos MySQL, PIX Itaú, ProJuris
- `sistema-gestao-monolith` — MVC custom, Bootstrap 4.5, ES6 modules, 3 bancos MySQL
- CRUDs e manutenção em CakePHP 2.x (Models, Controllers, Views .ctp)
- Manutenção do MVC customizado (Bd→Geral→Domínio)
- Bootstrap 3/4.5 + jQuery + plugins (Mask, FullCalendar, CKEditor, DataTables)
- Emails transacionais com PHPMailer (SMTP Gmail)
- Boletos bancários (padrão Itaú), relatórios PDF com Dompdf/html2pdf
- Deploy FTP via GitHub Actions (feature/staging/production)

#### Dev Frontend Website Static
- `obliviongrowth_website` — Site institucional estático (Next.js static export + Nginx Alpine)
- Sites com Next.js 15 App Router e saída `output: "export"`
- Tailwind CSS 4 + PostCSS, i18next, React 19
- Docker multi-stage (deps → build → nginx)
- CI/CD com GitHub Actions + GHCR
- 3 ambientes: dev (Docker Compose), staging e production (Portainer)

#### Dev Desktop Tauri
- `founders-brain` — Second Brain desktop app (Tauri 2, React 19, Vite, Rust)
- Aplicações desktop nativas multiplataforma (macOS, Windows, Linux)
- Backend Rust com Tokio (async), Serde (serialização), Chrono (datas)
- Plugins Tauri: Shell, Dialog, Log
- Tray icon, notificações do sistema
- IPC frontend↔backend via `invoke`/`tauri::command`
- React 19 + Vite + Tailwind no frontend
- CI/CD com GitHub Actions + `tauri-action`

#### Dev Backend PHP Legado
- Manutenção do `sistema-feb-monolith` (Ferreira & Borzone)
- Classes custom: Conexao→Geral→Dominio
- Scripts standalone em `scripts/`
- Cron jobs via `rotina.php`

#### DBA PostgreSQL
- `franquiaempada` — 15+ migrations, soft delete, pool_size=20, RBAC
- `vanessacrm_app` — PostgreSQL + Qdrant (vector DB), embeddings, multi-tenant
- `vanessacrm_chatbot` — BaseRepository genérico, entrypoint com wait-for-postgres
- `vexalabs_app` — 22 migrations, modelos com relationships complexas
- `vexalabs_fullstack-template` — User + Example base, template de projeto novo
- Migrations Alembic autogenerate, upgrade/downgrade, revisão manual
- Índices para performance de queries (busca por email, filtros por status)
- Soft delete pattern com `deleted_at` + filtro automático no BaseRepository
- Connection pooling (pool_size + max_overflow), health check `pg_isready`
- Entrypoint Docker: wait-for-postgres → `alembic upgrade head` → uvicorn

#### DBA MySQL
- `sistema-cobranca-monolith` — 4 bancos (sistemafb latin1, ferreiraeborzone utf8, bdgestaofb latin1, prod_delta utf8)
- `sistema-feb-monolith` — 4 bancos com charset misto, acesso via PDO + `mysql_*`
- `sistema-gestao-monolith` — 3 bancos, tabelas prefixo `TB_`, scripts em `transferencia-bd/`
- Gerenciamento de múltiplos bancos MySQL 5.7 no mesmo host
- Conexão PDO com prepared statements (e `mysql_connect` legado a ser evitado)
- Charset misto — `SET NAMES utf8` / `SET NAMES latin1` conforme o banco
- Scripts SQL incrementais sem sistema de migrations (não é Alembic)
- Dumps e restores com `mysqldump`, backups antes de ALTER TABLE

## Stack compartilhada

### Stack moderno
```
Linguagens     TypeScript 5.7, Python 3.12
Frontend       Next.js 15, React 19, Tailwind CSS 4, shadcn/ui, i18next
Backend        FastAPI, SQLModel, Pydantic v2, Alembic
Banco          PostgreSQL 18, Qdrant (vector DB)
Integrações    OpenAI SDK, Google APIs (Auth, Drive, Sheets), Uazapi (WhatsApp), ProJuris
Container      Docker, Docker Compose (multi-ambiente com profiles), GHCR (rmconsult-io, ferreiraeborzone, vexalabs-tech)
CI/CD          GitHub Actions
Deploy         Portainer stacks, Nginx Proxy Manager, Watchtower
```

### Stack legado
```
Linguagens     PHP 5.6, JavaScript (vanilla/jQuery)
Frontend       Bootstrap 3/4.5, jQuery 3.x, CKEditor, FullCalendar
Backend        CakePHP 2.x, MVC custom, Apache 2.4
Banco          MySQL 5.7.30 (múltiplos schemas, latin1/utf8)
Integrações    ProJuris, PIX Itaú, PHPMailer (SMTP Gmail)
Container      Docker (PHP 5.6 + Apache + FastAPI bridging)
CI/CD          GitHub Actions (FTP deploy + GHCR)
```

### Stack desktop (Tauri)
```
Linguagens     Rust (edition 2021), TypeScript 5.7
Frontend       React 19, Vite, Tailwind CSS, i18next
Backend        Tauri 2 (Rust), Tokio (async), Serde (JSON)
Plugin SDK     @tauri-apps/api, tauri-plugin-shell, tauri-plugin-dialog, tauri-plugin-log
Ferramentas    Cargo, chrono, log
Empacotamento  tauri build (DMG, AppImage, MSI)
CI/CD          GitHub Actions + tauri-action
```

### Stack de infraestrutura
```
Container      Docker Compose, Portainer, Watchtower, Nginx Proxy Manager, Dozzle
Monitoramento  Dozzle (logs), Watchtower (auto-update), Discord (notificações)
Backup         backup-routine (GHCR), retention configurável, notificação Discord
Redes          proxy network (externa, compartilhada), vexalabs_default (interna)
Registry       GHCR: rmconsult-io, ferreiraeborzone, vexalabs-tech, obliviongrowth
Deploy         Portainer stacks com profiles (development/staging/production)
```
