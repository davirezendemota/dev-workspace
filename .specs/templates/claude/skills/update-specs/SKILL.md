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

## Fluxo

1. **Ler** specs e checklist; restringir ao foco se `$ARGUMENTS` indicar spec/módulo.
2. **Auditar** backend, frontend, config e migrations para cada spec relevante.
3. **Classificar** cada AC: `done`, `in-progress`, `todo`, `blocked`.
4. **Atualizar** `features/*.md` (sem status/checkbox); manter AC IDs estáveis.
5. **Atualizar** `spec-checklist.json` (status, ACs faltantes, `before`/`after`, `updatedAt`).
6. **Resumir** alterações, gaps e dependências bloqueadas. Não commitar sem pedido explícito.
