# `.specs` — Especificações e rastreamento de progresso

Esta pasta concentra **o que** deve ser construído (specs em Markdown) e **onde estamos** na entrega (checklist em JSON). O conteúdo é pensado para humanos e para agentes de IA trabalharem com o mesmo contexto.

## Princípio central

| O quê | Onde vive |
|-------|-----------|
| Contexto, requisitos, fluxos, critérios de aceite | `features/*.md` |
| Status, issues, PRs, dependências entre itens | `spec-checklist.json` |

Specs descrevem comportamento e critérios de aceite com IDs estáveis (`AC1`, `AC2`…). **Não** use checkbox nem status dentro do Markdown — isso fica no checklist, que referencia a spec pelo `specId`.

## Estrutura da pasta

```
.specs/
├── README.md                    ← este arquivo
├── bootstrap-ai-rules.md        ← kit para CLAUDE.md, AGENTS.md e Cursor rules
├── spec-template.md             ← modelo para novas specs
├── spec-checklist.json          ← progresso, issues, PRs e cadeamento
├── spec-checklist.schema.json   ← schema JSON para validação
├── templates/                   ← commands e skills para copiar ao projeto
│   ├── cursor/commands/         ← /update-specs, /new-spec
│   ├── cursor/skills/           ← spec-checklist (pendências)
│   └── claude/skills/           ← equivalentes Claude Code
└── features/
    ├── 001-projects_ai-input.md
    ├── 002-settings.md
    ├── 003-projects.md
    ├── 004-projects_ai-summary.md
    ├── 005-agents.md
    ├── 006-projects_modal-dashboard.md
    ├── 007-spec-checklist_completion-metadata.md
    ├── 008-projects_tasks.md
    └── 009-projects_modal-settings.md
```

A pasta `.obsidian/` (se existir) é configuração local do editor Obsidian e não faz parte do fluxo de specs.

## Repositório canônico (upstream)

A pasta `.specs/` é mantida no repositório **[davirezendemota/dev-workspace](https://github.com/davirezendemota/dev-workspace)**. Quando copiada para outros projetos, use esse repositório como **fonte upstream** para atualizar a estrutura do kit (templates, bootstrap, schema, etc.).

| Campo | Valor |
|-------|-------|
| Repositório | `https://github.com/davirezendemota/dev-workspace` |
| Branch | `main` |
| Caminho no repo | `.specs/` |
| Raw (base) | `https://raw.githubusercontent.com/davirezendemota/dev-workspace/main/.specs/` |
| API GitHub | `https://api.github.com/repos/davirezendemota/dev-workspace/contents/.specs` |

Exemplos de URL raw para um arquivo:

- `https://raw.githubusercontent.com/davirezendemota/dev-workspace/main/.specs/bootstrap-ai-rules.md`
- `https://raw.githubusercontent.com/davirezendemota/dev-workspace/main/.specs/templates/cursor/commands/bootstrap-specs.md`

**O que sincronizar do upstream** (kit compartilhado):

- `bootstrap-ai-rules.md`
- `spec-template.md`
- `spec-checklist.schema.json`
- `templates/**`
- Este `README.md` (seções genéricas do fluxo)

**O que preservar no projeto consumidor** (específico do produto):

- `features/*.md`
- Entradas em `spec-checklist.json` (`projects`, specs, ACs, status)

Após atualizar `bootstrap-ai-rules.md` ou `templates/`, rode `/bootstrap-specs` para propagar commands, skills e rules no projeto.

## Criando uma nova spec

1. Copie `spec-template.md` para `features/`.
2. Renomeie seguindo a convenção de arquivos (veja abaixo).
3. Preencha todas as seções. Se algo não se aplica, escreva `N/A` em vez de apagar a seção.
4. Defina critérios de aceite com IDs estáveis na seção **6. Critérios de aceite** (`AC1`, `AC2`, …).
5. Registre a spec em `spec-checklist.json` com o mesmo `specId` e caminho em `specFile`.
6. Para cada AC, adicione um item no `checklist` com `status: "todo"`.

### Convenção de nomes de arquivo

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Feature | `{id}-{modulo}.md` | `002-settings.md` |
| Subfeature | `{id}-{modulo}_{featureslug}.md` | `001-projects_ai-input.md` |

- `id`: três dígitos (`001`, `002`, …), alinhado ao `specId` no checklist.
- `modulo`: área do produto (`settings`, `projects`, …).
- `featureslug`: slug da subfeature, quando aplicável.

## `spec-checklist.json`

Arquivo único que agrega o progresso de todos os projetos. Cada projeto agrupa suas specs.

```json
{
  "version": 1,
  "updatedAt": "2026-07-25",
  "projects": [
    {
      "id": "workspace",
      "name": "Workspace",
      "specs": [ /* ... */ ]
    }
  ]
}
```

### Campos por spec

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `specId` | sim | ID de três dígitos (`"003"`) |
| `specFile` | sim | Caminho relativo a `.specs/` (ex.: `features/003-projects.md`) |
| `title` | não | Título curto para exibição |
| `before` | não | Specs que dependem desta estar concluída |
| `after` | não | Specs que devem estar concluídas antes desta |
| `checklist` | sim | Lista de critérios de aceite com status |

### Campos por item do checklist (AC)

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `ac` | sim | ID do critério (`AC1`, `AC2`, …), igual ao da spec |
| `description` | não | Resumo do critério (espelha ou resume o `.md`) |
| `status` | sim | `todo`, `in-progress`, `blocked` ou `done` |
| `completedCommit` | não | Hash completo do commit que tornou o critério atendido; sua data/hora é a conclusão |
| `before` | não | ACs que dependem deste item |
| `after` | não | ACs que devem estar `done` antes deste |
| `issues` | não | Números de issues do GitHub |
| `prs` | não | Números de pull requests do GitHub |

Atualize `updatedAt` ao modificar o checklist.

`completedCommit` só pode ser usado com `status: "done"`. A data/hora de conclusão é herdada dos metadados desse commit e não é duplicada no checklist. Itens históricos concluídos podem permanecer sem o campo quando não houver evidência confiável para o backfill.

Ao carregar o checklist, o Dev Workspace resolve essa data/hora com `git show` no repositório de um projeto local. Para projetos GitHub, consulta o endpoint de commits da API do GitHub usando o PAT cadastrado no projeto. Se o commit não puder ser resolvido, o hash é preservado e a data/hora derivada fica indisponível.

Um commit não pode armazenar o próprio hash, pois seu conteúdo participa do cálculo desse hash. Por isso, primeiro faça o commit da implementação; depois marque o AC como `done`, apontando `completedCommit` para esse commit anterior. Ao reabrir um AC, remova o campo.

## Cadeamento (`before` / `after`)

Use `before` e `after` para declarar dependências sem duplicar regras de negócio no Markdown.

| Campo | Significado |
|-------|-------------|
| `after` | “Este item só faz sentido **depois** de…” |
| `before` | “Estes itens só podem avançar **depois** deste…” |

Funciona em dois níveis:

**Entre specs** — referência por `specId`:

```json
{
  "specId": "003",
  "after": ["002"],
  "before": ["001"]
}
```

**Entre ACs** — na mesma spec, use o ID do AC:

```json
{
  "ac": "AC2",
  "after": ["AC1"]
}
```

**Entre specs diferentes** — use objeto com `specId` e `ac`:

```json
{
  "ac": "AC2",
  "after": ["AC1", { "specId": "002", "ac": "AC3" }]
}
```

Declare a dependência em **um** dos lados (`after` no dependente ou `before` no pré-requisito). Não é obrigatório espelhar nos dois.

## Fluxo de trabalho sugerido

1. **Especificar** — escreva ou revise o `.md` em `features/`.
2. **Registrar** — garanta entrada correspondente em `spec-checklist.json`.
3. **Implementar** — marque ACs como `in-progress` enquanto trabalha.
4. **Vincular** — adicione números de PR em `prs` e de issue em `issues`.
5. **Concluir** — depois de verificar e commitar a implementação, mude o `status` para `done` e registre `completedCommit`.

Se um AC estiver bloqueado por dependência externa, use `blocked` até o pré-requisito ser resolvido.

## Validação

O checklist referencia o schema em `spec-checklist.schema.json`. Editores com suporte a JSON Schema (VS Code, Cursor) validam o arquivo automaticamente quando `$schema` está presente no topo do JSON.

## Para agentes de IA

Ao implementar uma feature:

1. Leia a spec em `features/{arquivo}.md` para entender escopo e critérios.
2. Consulte `spec-checklist.json` para status atual, dependências (`before`/`after`) e PRs/issues ligados.
3. Não altere IDs de AC na spec sem atualizar o checklist.
4. Atualize `status`, `prs` e `issues` no checklist ao concluir trabalho — não marque ACs como `done` no Markdown.
5. Em novas conclusões, registre o hash completo do commit da implementação em `completedCommit`; a data/hora vem desse commit. Ao reabrir, remova o campo.

### Integrar `.specs` em projeto novo

1. Copie a pasta `.specs/` para a raiz do repositório (ou use o [repositório canônico](#repositório-canônico-upstream) como referência).
2. Dispare o bootstrap pela IA com o prompt em [bootstrap-ai-rules.md](./bootstrap-ai-rules.md#prompt-para-disparar-o-bootstrap) — instala commands, skills, rules, `CLAUDE.md`, `AGENTS.md` e ajusta o checklist automaticamente.
3. Ou siga manualmente a seção **Bootstrap executável pela IA** no mesmo arquivo.

### Atualizar estrutura do kit (upstream)

Quando o usuário pedir para **atualizar o kit `.specs`**, **sincronizar templates** ou **trazer mudanças do upstream**:

1. Consulte o [repositório canônico](#repositório-canônico-upstream) (`davirezendemota/dev-workspace`, branch `main`, pasta `.specs/`).
2. Busque os arquivos do kit listados na seção upstream (via raw URL, API GitHub ou `gh api`).
3. Compare com a cópia local e faça merge — preserve `features/` e o checklist do projeto.
4. Execute `/bootstrap-specs` se `bootstrap-ai-rules.md` ou `templates/` tiverem mudado.
