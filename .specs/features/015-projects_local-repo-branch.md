# 015 Projects · Branch em repositório local

> **Última atualização:** 2026-07-30

---

## 1. Contexto e problema

Projetos **Manual · repo** leem specs (`.specs/spec-checklist.json` e features) do disco local.
O checkout atual do repositório pode estar em uma branch diferente da que contém as specs
atualizadas (ex.: código em `main`, specs em `feat/analise-recuperacao-credito`). Sem vincular
a branch das specs, o dashboard mostra conteúdo desatualizado ou vazio.

## 2. Objetivo

Permitir cadastrar e editar a **branch das specs** em projetos `local_repo` (padrão `main`),
ler checklist e features via `git show` nessa branch, e exibir no card o repositório no formato
`repo:branch` (ex.: `erp-varejo:feat/analise-recuperacao-credito`).

## 3. Escopo

### Dentro do escopo
- Campo `_meta.local_repo_branch` (padrão `main`) em projetos `local_repo`
- Leitura de spec-checklist e arquivos de feature a partir da branch configurada (`git show`)
- API expõe `local_repo_branch` e `local_repo_checked_out_branch` (checkout atual, somente leitura)
- Modal de criação e painel de settings com campo **Branch das specs** para `local_repo`
- Card de projeto: subtítulo `repo:branch` (GitHub usa `github_branch`; `local_repo` usa `local_repo_branch`)

### Fora do escopo
- Push/commit de specs pela plataforma
- Troca automática de checkout no repositório local
- Branch em projetos Manual (sem repo) ou GitHub (já possui `github_branch`)

## 4. Requisitos

### Funcionais
- **RF1:** Ao criar/editar projeto `local_repo`, o usuário informa `local_repo_branch` (default `main`).
- **RF2:** `GET /api/projects` e `GET /api/projects/{id}` retornam `local_repo_branch` e `local_repo_checked_out_branch`.
- **RF3:** Spec-checklist e conteúdo de features são lidos da branch configurada via `git show <branch>:<path>`.
- **RF4:** O card do projeto exibe o subtítulo no formato `repo:branch` para `local_repo` e GitHub.

### Não-funcionais
- **RNF1:** Se git não estiver disponível ou o path não for um repo, fallback para leitura do working tree.
- **RNF2:** Na criação/edição, quando o `local_path` é resolvível, a branch deve existir no repositório.

## 5. Fluxo / Comportamento esperado

1. Usuário cadastra projeto Manual · repo com caminho local e branch `feat/analise-recuperacao-credito`.
2. API grava `_meta.local_repo_branch = feat/analise-recuperacao-credito`.
3. Ao abrir Features, o backend lê `.specs/spec-checklist.json` com `git show feat/analise-recuperacao-credito:.specs/spec-checklist.json`.
4. No card, o subtítulo aparece como `erp-varejo:feat/analise-recuperacao-credito`.
5. No painel Settings (local_repo), o checkout atual no disco é exibido como informação de leitura quando detectável.

## 6. Critérios de aceite

- **AC1:** Dado um projeto `local_repo` com `local_repo_branch` configurada, quando o spec-checklist é carregado, então o conteúdo vem dessa branch (não do working tree divergente).
- **AC2:** Dado um projeto `local_repo` ou GitHub com branch configurada, quando o card é exibido, então o subtítulo do repositório segue o formato `repo:branch`.
- **AC3:** Dado criação/edição de projeto `local_repo`, quando o usuário não informa branch, então usa `main` como padrão.
- **AC4:** Dado painel de settings e modal de criação, quando o modo é Manual · repo, então há campo para branch das specs.

## 7. Decisões e alternativas consideradas

| Decisão | Alternativas descartadas | Motivo |
|---------|--------------------------|--------|
| Campo `local_repo_branch` separado de `github_branch` | Reutilizar `github_branch` | Semântica diferente; evita confusão entre fontes |
| `git show` para specs | Copiar arquivos / worktree extra | Simples, sem mutar o repo do usuário |
| Subtítulo `repo:branch` no card | Linhas separadas checkout/specs | Mais compacto; alinhado ao pedido de UX |

## 8. Riscos e questões em aberto

- Repositório sem git: fallback para filesystem continua funcionando.
- Branch renomeada/deletada: leitura falha graciosamente (lista vazia ou erro 404 em feature).
- `local_repo_checked_out_branch` pode ser `null` no container Docker se `local_path` do host não for resolvível no mount `/local-projects`.
