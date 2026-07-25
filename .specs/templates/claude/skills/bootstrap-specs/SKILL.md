---
name: bootstrap-specs
description: Executa o bootstrap completo de .specs/ — instala commands, skills, Cursor rules, CLAUDE.md, AGENTS.md e ajusta spec-checklist.json. Use com /bootstrap-specs ou quando o usuário pedir setup, bootstrap ou integrar .specs no projeto.
disable-model-invocation: true
argument-hint: [opções: nome do projeto, remover exemplos]
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# /bootstrap-specs

Execute o bootstrap completo conforme `.specs/bootstrap-ai-rules.md` — seção **"Bootstrap executável pela IA"** (passos 0–7).

Input opcional: `$ARGUMENTS`

Não alterar código de produto. Não commitar sem pedido explícito.

Entregar resumo com checklist de verificação e instruções de uso dos slash commands instalados.
