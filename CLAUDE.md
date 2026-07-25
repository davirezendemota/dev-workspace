# Workspace

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

- Marque ACs atendidos como `done` somente após verificar o critério na spec e existir um commit da implementação; preencha `completedCommit`. A data/hora de conclusão é herdada desse commit.
- Ao reabrir um AC concluído, remova `completedCommit`.
- Use `blocked` se houver impedimento externo documentado.
- Atualize `updatedAt` em `spec-checklist.json`.
- Se criou spec ou AC novo, confirme que `specId`, `specFile` e IDs `ACn` estão alinhados entre `.md` e JSON.

### Slash commands

- `/bootstrap-specs` — reinstalar integração .specs (rules, commands, skills)
- `/update-specs` — sincronizar specs/checklist com o código
- `/new-spec` — criar nova spec + checklist
- `/spec-checklist` — iniciar/concluir/bloquear ACs (ex.: "inicie AC2 da spec 003")

### O que não fazer

- Não marcar checkbox ou status dentro de `features/*.md`.
- Não remover ACs do checklist sem remover da spec (ou marcar como fora de escopo na spec).
- Não ignorar o checklist ao fechar uma tarefa relacionada a feature.
