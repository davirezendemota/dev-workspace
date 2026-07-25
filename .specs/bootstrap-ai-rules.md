# Bootstrap — regras de IA para `.specs`

Use este arquivo ao adicionar a pasta `.specs` em um **projeto novo**. O bootstrap completo pode ser executado **pela IA** — veja [Bootstrap executável pela IA](#bootstrap-executável-pela-ia).

Leia também [README.md](./README.md) para entender a estrutura da pasta.

---

## Bootstrap executável pela IA

Esta seção é o **playbook completo**. Quando o usuário pedir bootstrap, setup de `.specs`, ou enviar o prompt da seção [Prompt para disparar o bootstrap](#prompt-para-disparar-o-bootstrap), execute **todos** os passos abaixo sem pedir confirmação intermediária (exceto se um arquivo existente tiver conteúdo customizado que seria destruído — nesse caso, **merge** em vez de overwrite).

### Escopo permitido

| Pode alterar | Não alterar |
|--------------|-------------|
| `CLAUDE.md`, `AGENTS.md` | Código de produto (`backend/`, `frontend/`, `src/`, …) |
| `.cursor/rules/*.mdc` | `.env`, secrets, credenciais |
| `.cursor/commands/*.md` | Dependências (`package.json`, `Pipfile`, …) |
| `.cursor/skills/**/SKILL.md` | |
| `.claude/skills/**/SKILL.md` | |
| `.gitignore` (só regras que ignoram templates — Passo 1) | |
| `.specs/spec-checklist.json` (só `projects`, exemplos) | |

**Não commitar** unless o usuário pedir explicitamente.

### Passo 0 — Pré-requisitos

1. Confirmar que `.specs/` existe na raiz do repositório.
2. Ler `.specs/README.md` (visão geral).
3. Ler este arquivo (`bootstrap-ai-rules.md`).
4. Detectar ferramentas (presença de pastas/arquivos):
   - **Cursor**: sempre instalar `.cursor/rules`, `.cursor/commands`, `.cursor/skills`.
   - **Claude Code**: instalar `.claude/skills` se o usuário usa Claude ou se já existe `.claude/` na raiz.
   - **Ambos**: instalar tudo.

### Passo 1 — Garantir templates versionados (`.gitignore`)

Os diretórios `.specs/templates/cursor/` e `.specs/templates/claude/` **devem permanecer versionados** — são a fonte dos commands/skills instalados no Passo 2.

1. Se **não existe** `.gitignore` na raiz → pular este passo.
2. Ler `.gitignore` e **remover** qualquer linha (ativa ou comentada) que mencione:
   - `templates/cursor` ou `templates/claude`
   - `.specs/templates/cursor` ou `.specs/templates/claude`
   - Variantes com barra final, curingas ou prefixo `!` (ex.: `templates/cursor/`, `**/templates/claude/**`).
3. **Não adicionar** novas entradas para esses caminhos (nem ignore nem negação `!`).
4. **Não alterar** regras legítimas para `.cursor/` ou `.claude/` na raiz do projeto — são independentes de `.specs/templates/`.

Verificação rápida:

```bash
! grep -E '(^|/)(\.specs/)?templates/(cursor|claude)' .gitignore 2>/dev/null
```

Se o comando retornar linhas, ainda há menções a remover.

### Passo 2 — Instalar commands e skills (copiar templates)

**Fonte:** `.specs/templates/` → **destino:** raiz do projeto.

Execute (ou equivalente com ferramentas de escrita de arquivos):

```bash
# Cursor — slash commands
mkdir -p .cursor/commands .cursor/skills

cp .specs/templates/cursor/commands/update-specs.md .cursor/commands/update-specs.md
cp .specs/templates/cursor/commands/new-spec.md .cursor/commands/new-spec.md
cp .specs/templates/cursor/commands/bootstrap-specs.md .cursor/commands/bootstrap-specs.md

# Cursor — skill de pendências do checklist
cp -r .specs/templates/cursor/skills/spec-checklist .cursor/skills/spec-checklist

# Claude Code — skills (/update-specs, /new-spec, /spec-checklist)
mkdir -p .claude/skills
cp -r .specs/templates/claude/skills/update-specs .claude/skills/update-specs
cp -r .specs/templates/claude/skills/new-spec .claude/skills/new-spec
cp -r .specs/templates/claude/skills/spec-checklist .claude/skills/spec-checklist
cp -r .specs/templates/claude/skills/bootstrap-specs .claude/skills/bootstrap-specs
```

**Regras de overwrite:**

- Se o destino **não existe** → criar copiando o template integral.
- Se já existe e é **idêntico** ao template → não alterar.
- Se já existe com **conteúdo diferente** → fazer merge: preservar customizações do projeto e acrescentar o que falta do template; se irreconciliável, manter o existente e avisar no resumo final.

**Opcional (só se o usuário pedir skill global):**

```bash
mkdir -p ~/.cursor/skills
cp -r .specs/templates/cursor/skills/spec-checklist ~/.cursor/skills/spec-checklist
```

### Passo 3 — Cursor rules

Criar ou atualizar:

| Arquivo | `alwaysApply` | Template / conteúdo |
|---------|---------------|---------------------|
| `.cursor/rules/specs-workflow.mdc` | `true` | Seção [specs-workflow.mdc](#cursor---cursorrulesspecs-workflowmdc) abaixo |
| `.cursor/rules/specs-files.mdc` | `false`, `globs: .specs/**` | Seção [specs-files.mdc](#regra-opcional---ao-editar-arquivos-em-specs) abaixo |

Se `specs-workflow.mdc` já existir com o mesmo propósito, fazer merge em vez de duplicar.

### Passo 4 — `CLAUDE.md`

1. Se **não existe** → criar na raiz com o bloco da seção [CLAUDE.md](#claudemd--adicionar-na-raiz-do-projeto).
2. Se **existe** → acrescentar a seção `## Specs (`.specs/`)` se ainda não houver (buscar por `.specs/` ou `spec-checklist`).
3. Não duplicar a seção.

### Passo 5 — `AGENTS.md`

1. Se **não existe** → criar com o bloco da seção [AGENTS.md](#agentsmd--adicionar-na-raiz-do-projeto) **incluindo** o sub-bloco [Slash commands](#agentsmd--registrar-commands).
2. Se **existe** → merge das seções `Specs workflow` e `Slash commands` se ausentes.
3. Não duplicar.

### Passo 6 — Ajustar `spec-checklist.json`

1. Inferir `projects[].id` e `name` do repositório (nome da pasta, `package.json`, ou perguntar se ambíguo).
2. Substituir exemplo `workspace` se não for este projeto.
3. **Remover** specs de exemplo que não correspondem a arquivos reais em `.specs/features/` **ou** que o usuário indicou como irrelevantes.
4. Garantir que cada spec no JSON tem `specFile` existente e ACs alinhados ao `.md`.
5. Garantir que todo AC `done` tenha `completedCommit` válido; reconciliar violações com evidência em `git log` ou rebaixar status (ver `/update-specs`).
6. Atualizar `updatedAt` para a data atual (`YYYY-MM-DD`).
7. Validar mentalmente contra `.specs/spec-checklist.schema.json`.

### Passo 7 — Verificação

Checklist de saída (reportar cada item no resumo):

```
[ ] .gitignore — sem menções a templates/cursor ou templates/claude
[ ] .cursor/commands/update-specs.md
[ ] .cursor/commands/new-spec.md
[ ] .cursor/commands/bootstrap-specs.md
[ ] .cursor/skills/spec-checklist/SKILL.md
[ ] .claude/skills/update-specs/SKILL.md
[ ] .claude/skills/new-spec/SKILL.md
[ ] .claude/skills/spec-checklist/SKILL.md
[ ] .claude/skills/bootstrap-specs/SKILL.md
[ ] .cursor/rules/specs-workflow.mdc
[ ] .cursor/rules/specs-files.mdc
[ ] CLAUDE.md — seção Specs
[ ] AGENTS.md — Specs workflow + Slash commands
[ ] spec-checklist.json — projects id/name ajustados
```

Comandos de verificação rápida:

```bash
! grep -E '(^|/)(\.specs/)?templates/(cursor|claude)' .gitignore 2>/dev/null
test -f .cursor/commands/update-specs.md && test -f .cursor/commands/new-spec.md
test -f .cursor/skills/spec-checklist/SKILL.md
test -f .claude/skills/update-specs/SKILL.md
ls .specs/features/
```

### Passo 8 — Resumo para o usuário

Entregar em markdown:

1. **O que foi criado/alterado** (lista de arquivos).
2. **Checklist** do Passo 7 com ✅/❌.
3. **Como usar:** `/update-specs`, `/new-spec`, `/spec-checklist` e frases como "inicie AC2 da spec 003".
4. **Pendências** (ex.: specs de exemplo removidas, merges parciais, monorepo não configurado).
5. **Próximo passo sugerido:** rodar `/update-specs` para sincronizar com o código.

### Prompt para disparar o bootstrap

**Opção A — após copiar `.specs/` (antes de instalar commands):**

```text
Execute o bootstrap completo de .specs/ conforme .specs/bootstrap-ai-rules.md
(seção "Bootstrap executável pela IA"). Instale commands, skills, rules,
CLAUDE.md, AGENTS.md e ajuste spec-checklist.json. Não altere código de produto.
Não commitar. Resuma o que foi feito e o checklist de verificação.
```

**Opção B — após o bootstrap (command já instalado):**

```text
/bootstrap-specs
```

Variante com foco:

```text
Bootstrap .specs/ — leia .specs/bootstrap-ai-rules.md e execute todos os passos
da IA. Repo: {nome}. Remover specs de exemplo. Instalar Cursor + Claude Code.
```

---

## Checklist de setup (humano)

- [ ] Copiar a pasta `.specs/` para a raiz do projeto (ou manter como submódulo)
- [ ] Disparar o [prompt de bootstrap](#prompt-para-disparar-o-bootstrap) **ou** seguir os passos 0–8 manualmente
- [ ] Ajustar `projects[].id` e `projects[].name` em `spec-checklist.json` (Passo 6)
- [ ] Remover exemplos de `features/` e do checklist se não forem deste projeto
- [ ] Commitar `.specs/` + arquivos de IA no repositório (exceto `.obsidian/`)

---

## Commands e skills

### Mapa de templates → destino

| Template | Destino no projeto | Comando |
|----------|-------------------|---------|
| `templates/cursor/commands/update-specs.md` | `.cursor/commands/update-specs.md` | `/update-specs` |
| `templates/cursor/commands/new-spec.md` | `.cursor/commands/new-spec.md` | `/new-spec` |
| `templates/cursor/commands/bootstrap-specs.md` | `.cursor/commands/bootstrap-specs.md` | `/bootstrap-specs` |
| `templates/cursor/skills/spec-checklist/SKILL.md` | `.cursor/skills/spec-checklist/SKILL.md` | `/spec-checklist` |
| `templates/claude/skills/update-specs/SKILL.md` | `.claude/skills/update-specs/SKILL.md` | `/update-specs` |
| `templates/claude/skills/new-spec/SKILL.md` | `.claude/skills/new-spec/SKILL.md` | `/new-spec` |
| `templates/claude/skills/spec-checklist/SKILL.md` | `.claude/skills/spec-checklist/SKILL.md` | `/spec-checklist` |
| `templates/claude/skills/bootstrap-specs/SKILL.md` | `.claude/skills/bootstrap-specs/SKILL.md` | `/bootstrap-specs` |

### Resumo dos comandos

| Comando | Ferramenta | Função |
|---------|------------|--------|
| `/bootstrap-specs` | Cursor, Claude Code | Executa o bootstrap completo (rules, CLAUDE.md, AGENTS.md, commands, skills, checklist) |
| `/update-specs` | Cursor, Claude Code | Audita o código, sincroniza `features/*.md` + `spec-checklist.json` e reconcilia `completedCommit` em ACs `done` |
| `/new-spec` | Cursor, Claude Code | Cria spec nova a partir do template e registra ACs no checklist |
| `/spec-checklist` | Cursor, Claude Code | Inicia/conclui/bloqueia ACs; lista pendências ("inicie AC2 da spec 003") |

Texto após o comando (ou `$ARGUMENTS` no Claude) passa contexto — ex.: `/new-spec Settings: salvar tema dark mode` ou `/update-specs 003`.

### Cursor — formato dos commands

Arquivo: **plain Markdown** em `.cursor/commands/{nome}.md`. Nome do arquivo = nome do comando. Frontmatter opcional (`description`).

Conteúdo fonte: `templates/cursor/commands/*.md`.

### Claude Code — formato das skills

Diretório `.claude/skills/{nome}/SKILL.md` com frontmatter YAML. Conteúdo fonte: `templates/claude/skills/*/SKILL.md`.

Campos úteis:

```yaml
---
name: update-specs
description: ...
disable-model-invocation: true
argument-hint: [foco opcional]
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---
```

Legacy `.claude/commands/*.md` ainda funciona; preferir skills.

### AGENTS.md — registrar commands

Incluir no bloco de specs (Passo 5 do bootstrap):

```markdown
### Slash commands

- `/update-specs` — sync codebase → `.specs/features` + `spec-checklist.json`
- `/new-spec` — create spec from template + checklist entries
- `/spec-checklist` — start/complete/block ACs; list pendencies (e.g. "start AC2 of spec 003")

Installed from `.specs/templates/` via `.specs/bootstrap-ai-rules.md`.
```

### Skill `spec-checklist` — frases de exemplo

- "inicie a tarefa AC2 da spec 003"
- "conclua AC1 da spec settings"
- "bloqueie AC4 da 001"
- "pendências da spec 002"
- "qual o próximo AC da spec projects?"

---

## `CLAUDE.md` — adicionar na raiz do projeto

Cole o bloco abaixo em `CLAUDE.md`. Se o arquivo já existir, acrescente como nova seção.

```markdown
## Specs (`.specs/`)

Este projeto usa `.specs/` para especificações e rastreamento de progresso.

### Antes de implementar

1. Leia `.specs/README.md` se ainda não conhecer o fluxo.
2. Identifique a spec relevante em `.specs/features/` e o status em `.specs/spec-checklist.json`.
3. Respeite dependências `before` / `after` no checklist — não avance ACs bloqueados por pré-requisitos pendentes.
4. Se o escopo da tarefa não tiver spec, **crie uma** (a partir de `spec-template.md`) e registre no checklist antes de codar.

### Durante a implementação

- Marque o AC trabalhado como `in-progress` em `spec-checklist.json`.
- Vincule issues e PRs nos campos `issues` e `prs` do AC quando existirem.
- Comportamento e critérios de aceite vivem no `.md`; **status nunca** vai no Markdown da spec.
- Se o escopo mudar, atualize a spec em `features/` **e** o checklist — mantenha IDs de AC estáveis.

### Ao concluir

- Marque ACs atendidos como `done` somente após verificar o critério e existir um commit da implementação; preencha `completedCommit`. A data/hora de conclusão é herdada desse commit.
- Ao reabrir um AC concluído, remova `completedCommit`.
- Use `blocked` se houver impedimento externo documentado.
- Atualize `updatedAt` em `spec-checklist.json`.
- Se criou spec ou AC novo, confirme que `specId`, `specFile` e IDs `ACn` estão alinhados entre `.md` e JSON.

### Slash commands

- `/update-specs` — sincronizar specs/checklist com o código
- `/new-spec` — criar nova spec + checklist
- `/spec-checklist` — iniciar/concluir/bloquear ACs (ex.: "inicie AC2 da spec 003")

### O que não fazer

- Não marcar checkbox ou status dentro de `features/*.md`.
- Não remover ACs do checklist sem remover da spec (ou marcar como fora de escopo na spec).
- Não ignorar o checklist ao fechar uma tarefa relacionada a feature.
```

---

## `AGENTS.md` — adicionar na raiz do projeto

```markdown
## Specs workflow

The project keeps requirements in `.specs/features/*.md` and delivery state in `.specs/spec-checklist.json`.

**Start of task:** Read the matching spec file and checklist entry. Honor `before`/`after` dependencies. If no spec exists, create one from `.specs/spec-template.md` and register it in the checklist first.

**While working:** Set the AC `status` to `in-progress`. Add GitHub `issues` / `prs` numbers when available. Never write progress checkboxes in spec markdown.

**End of task:** Set completed ACs to `done` only after an implementation commit exists; add the full `completedCommit` and inherit completion date/time from that commit. Remove it when reopening an AC, use `blocked` for external deps, and bump `updatedAt`. Keep AC IDs in sync between markdown and JSON.

Reference: `.specs/README.md`

### Slash commands

- `/update-specs` — sync codebase → `.specs/features` + `spec-checklist.json`
- `/new-spec` — create spec from template + checklist entries
- `/spec-checklist` — start/complete/block ACs; list pendencies (e.g. "start AC2 of spec 003")

Installed from `.specs/templates/` via `.specs/bootstrap-ai-rules.md`.
```

---

## Cursor — `.cursor/rules/specs-workflow.mdc`

```markdown
---
description: Monitorar e atualizar .specs (features + checklist) em todo trabalho de feature
alwaysApply: true
---

# Specs workflow

Projeto com pasta `.specs/`. Detalhes em `.specs/README.md`.

## Início

- Antes de implementar feature ou mudança de escopo: ler spec em `.specs/features/` e status em `.specs/spec-checklist.json`.
- Respeitar `before` / `after` no checklist (spec e AC).
- Sem spec? Copiar `spec-template.md`, registrar em `spec-checklist.json`, depois implementar.

## Durante

- AC em trabalho → `status: "in-progress"` no checklist.
- PR/issue → preencher `prs` / `issues` no item do AC.
- Escopo mudou → atualizar `.md` e checklist; não renumerar ACs sem atualizar JSON.

## Fim

- AC verificado e com commit da implementação → `status: "done"` e `completedCommit`; a data/hora é herdada do commit. Ao reabrir, remover o campo.
- Impedimento externo → `blocked`.
- Atualizar `updatedAt` em `spec-checklist.json`.
- Nunca colocar status/checkbox em `features/*.md`.

## Commands

- `/update-specs` — reconciliar código com specs
- `/new-spec` — nova spec + checklist
- `/spec-checklist` — pendências do checklist
```

---

## Regra opcional — ao editar arquivos em `.specs/`

Salvar como `.cursor/rules/specs-files.mdc`:

```markdown
---
description: Validação ao editar arquivos de spec e checklist
globs: .specs/**
alwaysApply: false
---

# Edição de `.specs/`

- `spec-checklist.json` deve validar contra `spec-checklist.schema.json`.
- Cada `ac` no JSON deve existir na seção **Critérios de aceite** do `specFile` correspondente.
- `specId` de três dígitos alinhado ao prefixo do arquivo (`003-projects.md` → `"003"`).
- Novos itens `done` devem ter `completedCommit`; fora de `done`, o campo não pode existir. A data/hora de conclusão é herdada do commit.
- Ao alterar checklist, atualizar `updatedAt` (formato `YYYY-MM-DD`).
- Dependências: preferir declarar `after` no item dependente ou `before` no pré-requisito — não espelhar obrigatoriamente nos dois lados.
```

---

## Personalização por projeto

| Campo | Onde ajustar |
|-------|----------------|
| Nome do projeto no checklist | `spec-checklist.json` → `projects[].id` e `name` |
| ID do repositório GitHub (issues/PRs) | Documentar no `CLAUDE.md` do projeto, se útil |
| Projeto único vs. monorepo | Um `projects[]` por app/pacote; cada um com seu array `specs` |

### Monorepo (vários pacotes)

```json
{
  "projects": [
    { "id": "api", "name": "Backend API", "specs": [] },
    { "id": "web", "name": "Frontend", "specs": [] }
  ]
}
```

Use `specFile` relativo a `.specs/` (ex.: `features/api/010-auth.md`).

---

## Manutenção

- Ao evoluir o formato (novos campos no schema), atualize este bootstrap, os templates em `.specs/templates/` e os projetos que já usam `.specs/`.
- O [README.md](./README.md) é a documentação humana; este arquivo é o kit de integração com ferramentas de IA.
