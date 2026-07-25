# /bootstrap-specs

Execute o **bootstrap completo** de `.specs/` neste repositório.

Leia e siga **integralmente** a seção **"Bootstrap executável pela IA"** em `.specs/bootstrap-ai-rules.md` (passos 0–8).

Contexto opcional do usuário: `$ARGUMENTS` (ex.: nome do projeto, remover exemplos, só Cursor).

## Obrigatório

1. Garantir que `.gitignore` não mencione `templates/cursor` nem `templates/claude` (Passo 1 do bootstrap).
2. Instalar commands e skills copiando de `.specs/templates/` (ver Passo 2 do bootstrap).
3. Criar `.cursor/rules/specs-workflow.mdc` e `specs-files.mdc`.
4. Criar ou fazer merge em `CLAUDE.md` e `AGENTS.md`.
5. Ajustar `spec-checklist.json` (`projects`, remover exemplos inválidos, `updatedAt`).
6. Rodar checklist de verificação e entregar resumo markdown.

## Proibido

- Alterar código de produto.
- Commitar sem pedido explícito.
- Duplicar seções já existentes em `CLAUDE.md` / `AGENTS.md`.

## Saída

Resumo com: arquivos criados/alterados, checklist ✅/❌, como usar `/update-specs`, `/new-spec`, `/spec-checklist`, pendências e próximo passo (`/update-specs`).
