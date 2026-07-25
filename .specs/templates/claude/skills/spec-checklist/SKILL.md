---
name: spec-checklist
description: Gerencia pendências do spec-checklist.json — iniciar, concluir, bloquear ACs e listar status por spec. Use quando o usuário pedir iniciar/concluir/bloquear uma tarefa ou AC de uma spec (ex. "inicie a tarefa AC2 da spec 003").
disable-model-invocation: true
argument-hint: [ação] [AC] [spec specId ou título]
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# Spec checklist — manipulação de pendências

Gerencia `.specs/spec-checklist.json`. Detalhes em `.specs/templates/cursor/skills/spec-checklist/SKILL.md` — siga o mesmo fluxo:

- Resolver spec (`specId`, título) e AC (`ACn`, descrição) a partir de `$ARGUMENTS`.
- Checar `after` / `before` antes de `in-progress`.
- Ações: iniciar → `in-progress`; concluir → `done`; bloquear → `blocked`; reabrir → `todo`; listar pendências.
- Ao concluir, verificar o critério e identificar um commit já existente que o tornou atendido. Normalizar o hash completo com `git rev-parse <ref>^{commit}`; se a implementação ainda estiver sem commit, não marcar `done` nem criar commit sem pedido explícito.
- Em um novo `done`, preencher `completedCommit` (hash completo); a data/hora de conclusão é herdada do commit. Ao sair de `done`, remover o campo. Não inventar backfill para conclusões históricas.
- Atualizar `updatedAt`; nunca status no Markdown da spec.
- Resposta estruturada com status anterior → novo e próximo AC sugerido.

`completedCommit` aponta para o commit anterior da implementação. O commit que atualiza o checklist não pode armazenar o próprio hash.
