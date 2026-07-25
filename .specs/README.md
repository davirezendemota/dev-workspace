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
    └── 004-projects_ai-summary.md
```

A pasta `.obsidian/` (se existir) é configuração local do editor Obsidian e não faz parte do fluxo de specs.

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
| `before` | não | ACs que dependem deste item |
| `after` | não | ACs que devem estar `done` antes deste |
| `issues` | não | Números de issues do GitHub |
| `prs` | não | Números de pull requests do GitHub |

Atualize `updatedAt` ao modificar o checklist.

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
5. **Concluir** — mude o `status` para `done` quando o critério estiver atendido.

Se um AC estiver bloqueado por dependência externa, use `blocked` até o pré-requisito ser resolvido.

## Validação

O checklist referencia o schema em `spec-checklist.schema.json`. Editores com suporte a JSON Schema (VS Code, Cursor) validam o arquivo automaticamente quando `$schema` está presente no topo do JSON.

## Para agentes de IA

Ao implementar uma feature:

1. Leia a spec em `features/{arquivo}.md` para entender escopo e critérios.
2. Consulte `spec-checklist.json` para status atual, dependências (`before`/`after`) e PRs/issues ligados.
3. Não altere IDs de AC na spec sem atualizar o checklist.
4. Atualize `status`, `prs` e `issues` no checklist ao concluir trabalho — não marque ACs como `done` no Markdown.

### Integrar `.specs` em projeto novo

1. Copie a pasta `.specs/` para a raiz do repositório.
2. Dispare o bootstrap pela IA com o prompt em [bootstrap-ai-rules.md](./bootstrap-ai-rules.md#prompt-para-disparar-o-bootstrap) — instala commands, skills, rules, `CLAUDE.md`, `AGENTS.md` e ajusta o checklist automaticamente.
3. Ou siga manualmente a seção **Bootstrap executável pela IA** no mesmo arquivo.
