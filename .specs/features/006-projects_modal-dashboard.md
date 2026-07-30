# 006 Projects · Modal dashboard

> **Última atualização:** 2026-07-25

---

## 1. Contexto e problema

Os cards de projeto na aba Projects mostram um resumo compacto, mas o usuário
precisa de uma visão detalhada do progresso de entrega — especialmente os
critérios de aceite documentados em `.specs/spec-checklist.json` do repositório
associado ao projeto.

## 2. Objetivo

O usuário expande um card de projeto e visualiza, em um modal com aba
**Spec checklist**, estatísticas e a lista de specs/ACs do `spec-checklist.json` do
repositório local ou GitHub vinculado ao projeto.

## 3. Escopo

### Dentro do escopo
- Botão expandir no card de projeto (hover) abre `ProjectDetailModal`
- Modal com cabeçalho (nome, repo) e abas **Spec checklist**, **Tasks** (spec 008) e **Settings** (spec 009)
- `ProjectSpecChecklist` com métricas agregadas de ACs (AC2 — pendente na UI)
- Tabela por spec: AC, descrição, status (badge), data de conclusão, issues e PRs
- Busca por AC, descrição, status, hash ou data de conclusão
- API `GET /api/projects/{id}/spec-checklist`
- Leitura do checklist a partir de:
  - repositório local (`_meta.local_path`) → arquivo em disco
  - projeto GitHub (`_meta` com PAT) → fetch remoto
- Resolução do bloco `projects[]` no JSON por candidatos de id
  (`spec_project_id`, slug do projeto, nome, basename do `local_path`)
- Override de caminho via `_meta.spec_checklist_path` (default: `.specs/spec-checklist.json`)
- Estados: loading, erro, vazio (sem specs/ACs)
- Uso do checklist como contexto na geração de resumo IA ([[004-projects_ai-summary]])
- Grafo documental entre specs (wikilinks) na aba Grafo — ver [[014-projects_spec-graph]]

### Fora do escopo
- Edição do spec-checklist do repositório pela UI (somente leitura nesta spec)
- Tasks editáveis (especificado em 008-projects_tasks)
- Edição de metadados do projeto (especificado em 009-projects_modal-settings)
- Sincronização bidirecional com o repositório
- Auth / autorização no endpoint
- Visualização do Markdown das specs (apenas metadados do checklist)
- Projetos Manual sem `local_path` nem GitHub: spec checklist permanece vazio

## 4. Requisitos

### Funcionais
- **RF1:** Botão expandir no card abre modal com nome e repo do projeto.
- **RF2:** Aba Spec checklist carrega `GET /api/projects/{id}/spec-checklist` ao abrir.
- **RF3:** Exibir cards de estatística: total, concluídos, em progresso, bloqueados, pendentes.
- **RF4:** Listar specs com `specId`, título, `specFile` e tabela de ACs.
- **RF5:** Cada AC exibe id, descrição, badge de status, data de conclusão e issues/PRs quando presentes.
- **RF6:** Para projeto com `local_path`, ler checklist do filesystem do repo local.
- **RF7:** Para projeto GitHub, buscar checklist via Contents API com credenciais em `_meta`.
- **RF8:** Resolver entrada em `projects[]` usando `spec_project_id` ou heurísticas de slug.
- **RF9:** Estado vazio orienta a adicionar `.specs/spec-checklist.json` e configurar `local_path` ou `spec_project_id`.
- **RF10:** Fechar modal com botão ✕, clique no backdrop ou tecla Escape.

### Não-funcionais
- **RNF1:** Leitura somente; falha ao carregar checklist não quebra o modal.
- **RNF2:** PAT de GitHub nunca exposto no frontend (permanece em `_meta` no servidor).
- **RNF3:** Status desconhecido no JSON normalizado para `todo`.

## 5. Fluxo / Comportamento esperado

### Abertura do modal
1. Usuário passa o mouse sobre um card de projeto → botão expandir aparece.
2. Usuário clica em expandir → `ProjectDetailModal` abre com aba Spec checklist ativa.
3. `ProjectSpecChecklist` dispara `GET /api/projects/{id}/spec-checklist`.

### Spec checklist com dados
1. API resolve origem (local_path ou GitHub) e lê `.specs/spec-checklist.json`.
2. API encontra o bloco `projects[]` correspondente ao projeto.
3. Frontend exibe estatísticas e tabelas por spec com badges de status.
4. Issues e PRs aparecem abaixo da descrição do AC quando preenchidos no JSON.

### Sem checklist
1. Projeto sem repo, arquivo ausente ou id não encontrado → `specs: []`.
2. Estatísticas zeradas; mensagem orienta configurar repo e checklist.

### Erro
1. Falha de rede ou 404 no projeto → banner `role="alert"` com mensagem amigável.

**Estados:** loading (“Carregando spec-checklist…”); sucesso com dados; vazio; erro.

## 6. Critérios de aceite

- **AC1:** Dado um card de projeto, quando o usuário clica em expandir, então o modal de detalhe abre com nome e repositório do projeto.
- **AC2:** Dado checklist carregado, quando a aba Spec checklist é exibida, então as estatísticas de ACs (total, concluídos, em progresso, bloqueados, pendentes) são mostradas.
- **AC3:** Dado specs no checklist, quando o spec checklist renderiza, então cada spec aparece com tabela de ACs, descrição e badge de status.
- **AC4:** Dado projeto com `_meta.local_path` válido, quando a API é consultada, então o checklist é lido do repositório local em `spec_checklist_path`.
- **AC5:** Dado projeto GitHub com credenciais em `_meta`, quando a API é consultada, então o checklist remoto é buscado e parseado.
- **AC6:** Dado projeto sem repo ou checklist inexistente, quando o spec checklist carrega, então exibe estado vazio com orientação ao usuário.
- **AC7:** Dado AC com `issues` ou `prs` no JSON, quando a tabela é renderizada, então os números são exibidos na linha do AC.
- **AC8:** Dado `_meta.spec_project_id` configurado, quando o checklist é resolvido, então o bloco `projects[]` correspondente a esse id é utilizado.

## 7. Decisões e alternativas consideradas

| Decisão | Alternativas descartadas | Motivo |
|---------|--------------------------|--------|
| Modal sobre o dashboard | Página dedicada `/projects/{id}` | Mantém contexto da lista de cards |
| Leitura do checklist no repo | Duplicar ACs no JSON do projeto | Fonte única no repositório do código |
| Heurísticas de slug para match | Exigir sempre `spec_project_id` | Funciona out-of-the-box com convenções comuns |
| Somente leitura | Editar status pela UI | Escopo menor; checklist editado no repo |
| Três abas no modal (spec checklist, tasks, settings) | Uma aba única | Separação de responsabilidades entre specs 006, 008 e 009 |
| Stats computados no backend | Agregar no frontend | Consistência com uso em resumo IA (spec 004) |

## 8. Riscos e questões em aberto

- Projetos Manual puro não terão spec checklist útil até ter `local_path` ou sync GitHub; tasks editáveis estão na spec 008.
- Checklist GitHub depende de PAT válido e caminho correto no repositório remoto.
- Card não atualiza em tempo real se o checklist mudar no disco (requer reabrir modal).
- **AC2 pendente:** a API retorna `stats`, mas `ProjectSpecChecklist` ainda não renderiza os cards de estatística (removidos em `90b1e15`).

**API:**

- `GET /api/projects/{id}/spec-checklist` →
  `{ checklist_path, updated_at, global_updated_at, project_id, project_name, specs, source, stats }`

**Meta do projeto (trechos relevantes):**

```json
{
  "_meta": {
    "source_type": "local_repo",
    "local_path": "/local-projects/meu-repo",
    "spec_project_id": "workspace",
    "spec_checklist_path": ".specs/spec-checklist.json"
  }
}
```

**Resposta (trecho):**

```json
{
  "checklist_path": ".specs/spec-checklist.json",
  "project_id": "workspace",
  "project_name": "Workspace",
  "stats": { "total": 27, "done": 20, "in_progress": 2, "blocked": 0, "todo": 5 },
  "specs": [
    {
      "specId": "003",
      "title": "Projects",
      "specFile": "features/003-projects.md",
      "checklist": [
        { "ac": "AC1", "description": "...", "status": "done", "issues": [], "prs": [] }
      ]
    }
  ]
}
```
