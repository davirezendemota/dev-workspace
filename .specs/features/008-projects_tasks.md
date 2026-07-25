# 008 Projects · Tasks

> **Última atualização:** 2026-07-25

---

## 1. Contexto e problema

Todo projeto precisa de uma lista editável de tarefas simples, independente de ter
repositório ou `.specs/spec-checklist.json`. O **spec checklist** (spec 006) cobre
critérios de aceite; **tasks** são booleanas e livres.

## 2. Objetivo

O usuário abre o modal de qualquer projeto e gerencia tasks — adicionar, renomear,
remover e marcar itens — com persistência adequada ao tipo de projeto.

## 3. Escopo

### Dentro do escopo
- Aba **Tasks** no `ProjectDetailModal` para todos os tipos de projeto
- CRUD completo de itens
- **Manual (`local`)**, **Manual · repo (`local_repo`)** e **GitHub**: campo `tasks` embutido no JSON do projeto (`workspace_data/projects/{id}.json`)
- API `GET` e `PUT /api/projects/{id}/tasks`
- Leitura/escrita local para todos os tipos; migração de `tasks.json` remoto legado em projetos GitHub antigos
- Migração automática de legados (`checklist`, sidecars `*.tasks.json`, `*.checklist.json`, etc.) para o campo embutido em projetos manuais
- Arquivos `*.tasks.json` na pasta de projetos excluídos da listagem (legado)

### Fora do escopo
- Escrita de tasks no disco do repositório local (`local_repo` é somente leitura)
- Issues, PRs, commits ou metadados de conclusão
- Specs, critérios de aceite (`ACn`)
- Exibição de tasks no card compacto da listagem

## 4. Requisitos

### Funcionais
- **RF1:** Modal de projeto exibe aba Tasks para `local`, `local_repo` e `github`.
- **RF2:** `GET /api/projects/{id}/tasks` retorna documento; ausente → `{ version: 1, items: [] }`.
- **RF3:** `PUT /api/projects/{id}/tasks` valida e persiste conforme o tipo.
- **RF4:** Itens têm `id` único, `label` e `done` (boolean estrito).
- **RF5:** `_meta.tasks_path` removido — tasks de GitHub também ficam no JSON local.
- **RF6:** Campo `checklist` removido do JSON principal do projeto.
- **RF7:** Arquivos `*.tasks.json` na pasta de projetos não aparecem em `GET /api/projects`.

### Por tipo de projeto

| Tipo | Persistência |
|------|--------------|
| `local` | Campo `tasks` no `{id}.json` |
| `local_repo` | Campo `tasks` no `{id}.json` (repo local não é escrito) |
| `github` | Campo `tasks` no `{id}.json` (workspace_data) |

## 5. Não-funcionais

- **RNF1:** Falha ao carregar ou salvar tasks não quebra o modal.
- **RNF2:** PAT de GitHub nunca exposto no frontend.
- **RNF3:** IDs de itens gerados no servidor; labels não vazias após trim.

## 6. Critérios de aceite

- **AC1:** Dado qualquer tipo de projeto, quando o modal abre, então a aba Tasks está disponível.
- **AC2:** Dado projeto manual sem tasks, quando a API é consultada, então retorna lista vazia.
- **AC3:** Dado CRUD de item em projeto manual, quando o usuário salva, então o campo `tasks` no JSON do projeto persiste após recarregar.
- **AC4:** Dado marcar/desmarcar, quando o usuário salva, então `done` é persistido.
- **AC5:** Dado `{id}.tasks.json` legado na pasta de projetos, então migra para o JSON embutido e não aparece em `GET /api/projects`.
- **AC6:** Dado legado `checklist` ou sidecar antigo, então migra para `tasks` embutido na primeira leitura.
- **AC7:** Dado projeto GitHub legado com tasks remotas, então migra para o campo `tasks` embutido na primeira leitura.

## 8. API

- `GET /api/projects/{id}/tasks` → `{ version, items, tasks_path, source, updated_at }`
- `PUT /api/projects/{id}/tasks` → documento validado e gravado
