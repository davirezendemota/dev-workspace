---
name: update-specs
description: Audita o código do repositório e sincroniza .specs/features e spec-checklist.json com o estado real. Use com /update-specs ou quando o usuário pedir atualizar, sincronizar ou reconciliar specs com o projeto.
disable-model-invocation: true
argument-hint: [foco opcional: specId, módulo ou path]
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# /update-specs

Sincronize `.specs/` com o **código atual**. Não invente — confirme cada mudança no repositório.

Foco opcional: `$ARGUMENTS`

## Referências

- `.specs/README.md`
- `.specs/spec-checklist.json` + `spec-checklist.schema.json`
- `.specs/features/*.md`

## Invariante de conclusão

Todo AC com `status: "done"` **deve** ter `completedCommit` (hash completo válido). A data de conclusão no dashboard é derivada desse commit — **sem `completedCommit`, não há data**.

- **Nunca** finalize com `done` sem `completedCommit`.
- **Nunca** marque `done` novo sem identificar o commit da implementação.
- Implementação sem commit → manter `in-progress`.

## Fluxo

1. **Ler** specs e checklist; restringir ao foco se `$ARGUMENTS` indicar spec/módulo. Listar ACs `done` sem `completedCommit`.
2. **Auditar** backend, frontend, config e migrations para cada spec relevante.
3. **Classificar** cada AC: `done` (só se implementado **e** commit identificável), `in-progress`, `todo`, `blocked`.
4. **Atualizar** `features/*.md` (sem status/checkbox); manter AC IDs estáveis.
5. **Atualizar** `spec-checklist.json` (status, ACs faltantes, `before`/`after`, `updatedAt`):
   - Novo `done`: preencher `completedCommit` com hash completo via `git rev-parse <ref>^{commit}`.
   - Ao sair de `done`, remover `completedCommit`.
   - Não criar commit sem pedido explícito.
6. **Rastrear commits** — varrer todos os ACs `done`:
   - Sem `completedCommit` ou hash inválido: buscar evidência (`git log -- <paths>`, PR/issue, histórico da feature).
   - Evidência confiável → backfill `completedCommit`.
   - Sem evidência → rebaixar para `in-progress` (código existe) ou `todo` (incerto); **não** manter `done`.
   - Validar hashes com `git cat-file -e <hash>^{commit}`.
   - Confirmar invariante: zero `done` sem `completedCommit` válido.
7. **Resumir** alterações, backfills, rebaixamentos, gaps e dependências bloqueadas. Não commitar sem pedido explícito.

O commit que atualiza o checklist não pode referenciar o próprio hash; `completedCommit` aponta para o commit anterior da implementação.
