# /update-specs

Sincronize `.specs/` com o **código atual** do repositório. Não invente — cada mudança em spec ou checklist deve ser confirmada no código.

Contexto adicional do usuário (opcional): `$ARGUMENTS` ou texto após o comando.

## Referências

- `.specs/README.md`
- `.specs/spec-checklist.json` + `spec-checklist.schema.json`
- `.specs/features/*.md`

## Passo 1 — Ler estado atual

1. Liste specs em `.specs/features/` e entradas em `spec-checklist.json`.
2. Se o usuário passou foco (ex.: `settings`, `003`, `projects`), restrinja a esse escopo.

## Passo 2 — Auditar o código

Para cada spec relevante, confirme no repositório:

- Rotas, controllers, services, models, DTOs, migrations (backend).
- Componentes, páginas, API routes, libs (frontend).
- Config, env, compose, scripts de deploy quando aplicável.

Classifique cada AC como: **done** (implementado e verificável), **in-progress** (parcial), **todo** (não iniciado), **blocked** (impedimento externo documentado).

## Passo 3 — Atualizar specs (Markdown)

- Corrija divergências entre `features/*.md` e o código as-built.
- Mantenha IDs de AC estáveis; não renumerar sem atualizar o JSON.
- Não adicione checkbox nem status no Markdown.
- Atualize `Última atualização` na spec quando o conteúdo mudar.

## Passo 4 — Atualizar checklist (JSON)

- Alinhe `status` de cada AC com a auditoria.
- Adicione ACs faltantes no JSON (e na spec) se o código entregou critérios não documentados.
- Remova ou marque fora de escopo na spec antes de remover do checklist.
- Valide `before` / `after` — ajuste se dependências mudaram.
- Atualize `updatedAt` (formato `YYYY-MM-DD`).

## Passo 5 — Resumo

Entregue:

1. Tabela spec → ACs alterados (status anterior → novo).
2. Specs/docs criados ou editados.
3. Gaps: código sem spec, spec sem código, ACs bloqueados por dependência.
4. Não commitar unless o usuário pedir.
