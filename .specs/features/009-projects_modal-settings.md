# 009 Projects · Modal settings

> **Última atualização:** 2026-07-25

---

## 1. Contexto e problema

Projetos armazenam metadados de origem em `_meta` (tipo, caminho local, GitHub,
`spec_project_id`). Hoje só é possível definir isso na criação; alterar depois
exige editar o JSON manualmente.

## 2. Objetivo

O usuário edita os metadados do projeto na aba **Settings** do modal de detalhe,
incluindo tipo de origem, ID do arquivo, `spec_project_id` e caminhos GitHub/local.

## 3. Escopo

### Dentro do escopo
- Aba **Settings** em `ProjectDetailModal`
- Formulário `ProjectSettingsPanel` com tipo Manual / Manual·repo / GitHub
- Campos: ID do projeto (slug do arquivo), `spec_project_id`, `spec_checklist_path`
- Campos condicionais: `local_path` (local_repo), credenciais GitHub (github)
- `PUT /api/projects/{id}` aceita `source_type`, `new_id`, `spec_project_id` e campos de origem
- Renomear arquivo JSON ao alterar ID do projeto
- PAT GitHub opcional na edição quando já configurado

### Fora do escopo
- Edição do conteúdo do `project.json` (nome, client, checkpoints)
- Sincronização automática após trocar para GitHub
- Exclusão de projeto pela aba Settings

## 4. Requisitos

### Funcionais
- **RF1:** Modal exibe aba Settings para todos os tipos de projeto.
- **RF2:** Usuário altera `source_type` entre local, local_repo e github.
- **RF3:** Usuário edita ID do projeto (renomeia o arquivo na pasta de projetos).
- **RF4:** Usuário edita `spec_project_id` e `spec_checklist_path`.
- **RF5:** Para local_repo, usuário edita `local_path`.
- **RF6:** Para github, usuário edita repo, branch e PAT (opcional se já existir).
- **RF7:** Salvar persiste `_meta` e atualiza lista de cards.

### Não-funcionais
- **RNF1:** PAT nunca retornado na API; apenas `has_github_pat`.
- **RNF2:** Validação de campos obrigatórios por tipo no servidor.

## 5. Fluxo / Comportamento esperado

1. Usuário abre modal → aba Settings.
2. Altera campos desejados → Salvar.
3. API atualiza `_meta` e renomeia arquivo se `new_id` mudou.
4. Dashboard reflete novo tipo/repo; modal permanece aberto com dados atualizados.

## 6. Critérios de aceite

- **AC1:** Dado o modal de projeto aberto, quando o usuário seleciona a aba Settings, então o formulário de metadados é exibido.
- **AC2:** Dado um projeto local_repo, quando o usuário altera `local_path` e salva, então o valor persiste em `_meta.local_path`.
- **AC3:** Dado um projeto, quando o usuário altera `spec_project_id` e salva, então o valor persiste em `_meta.spec_project_id`.
- **AC4:** Dado um projeto, quando o usuário troca o tipo para GitHub com credenciais válidas e salva, então `_meta.source_type` é `github` e campos GitHub são gravados.
- **AC5:** Dado um projeto, quando o usuário altera o ID do projeto e salva, então o arquivo JSON é renomeado e o card usa o novo id.
- **AC6:** Dado projeto GitHub com PAT já salvo, quando o usuário salva sem informar novo PAT, então o token existente é mantido.

## 7. Decisões e alternativas consideradas

| Decisão | Alternativas descartadas | Motivo |
|---------|--------------------------|--------|
| Aba Settings no modal existente | Editar só via Settings global | Metadados são por projeto |
| `PUT` estendido | Endpoint `/meta` separado | Reutiliza rota existente |
| Renomear arquivo via `new_id` | Exigir recriar projeto | UX mais simples |

## 8. Riscos e questões em aberto

- Trocar tipo não sincroniza dados do repositório automaticamente.
- Renomear ID com sidecar legado `.spec-checklist.json` remove o sidecar (não renomeia).
- Exclusão de projeto pela aba Settings existe no código (WIP, não commitado) mas permanece fora do escopo desta spec.
