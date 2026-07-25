---
name: new-spec
description: Cria uma nova feature spec em .specs/features e registra todos os ACs em spec-checklist.json. Use com /new-spec ou quando o usuário pedir criar, abrir ou registrar uma nova spec.
disable-model-invocation: true
argument-hint: [título e escopo da feature]
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# /new-spec

Crie spec + entrada no checklist a partir de `spec-template.md`.

Input do usuário: `$ARGUMENTS`

## Referências

- `.specs/spec-template.md`
- `.specs/README.md`
- `.specs/spec-checklist.json`

## Fluxo

1. **Coletar** título, módulo, subfeature (opcional), ACs iniciais e dependências — usar `$ARGUMENTS` ou perguntar em uma rodada.
2. **specId** = próximo `NNN` disponível no checklist.
3. **Arquivo** `features/{specId}-{modulo}[_{slug}].md` — todas as seções; ACs na seção 6; sem checkbox/status.
4. **Checklist** — registrar spec com um item `todo` por AC; `issues`/`prs` vazios; `before`/`after` se houver.
5. **Validar** contra schema; alinhar AC IDs; atualizar `updatedAt`.
6. **Resumir** caminho, specId, ACs e dependências. Não commitar sem pedido explícito.
