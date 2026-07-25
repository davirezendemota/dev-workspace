# /update-specs

Sincronize `.specs/` com o **código atual** do repositório. Não invente — cada mudança em spec ou checklist deve ser confirmada no código.

Contexto adicional do usuário (opcional): `$ARGUMENTS` ou texto após o comando.

## Referências

- `.specs/README.md`
- `.specs/spec-checklist.json` + `spec-checklist.schema.json`
- `.specs/features/*.md`

## Invariante de conclusão

Todo AC com `status: "done"` **deve** ter `completedCommit` (hash completo válido). A data de conclusão no dashboard é derivada desse commit — **sem `completedCommit`, não há data**.

- **Nunca** deixe `done` sem `completedCommit` ao finalizar o comando.
- **Nunca** marque `done` novo sem identificar o commit da implementação.
- Se a implementação existir mas ainda não houver commit, mantenha `in-progress`.

## Passo 1 — Ler estado atual

1. Liste specs em `.specs/features/` e entradas em `spec-checklist.json`.
2. Se o usuário passou foco (ex.: `settings`, `003`, `projects`), restrinja a esse escopo.
3. Liste ACs `done` sem `completedCommit` (violations) para reconciliar no passo 5.

## Passo 2 — Auditar o código

Para cada spec relevante, confirme no repositório:

- Rotas, controllers, services, models, DTOs, migrations (backend).
- Componentes, páginas, API routes, libs (frontend).
- Config, env, compose, scripts de deploy quando aplicável.

Classifique cada AC como:

- **done** — implementado, verificável **e** com commit identificável para `completedCommit`
- **in-progress** — parcial ou implementado sem commit rastreável
- **todo** — não iniciado
- **blocked** — impedimento externo documentado

## Passo 3 — Atualizar specs (Markdown)

- Corrija divergências entre `features/*.md` e o código as-built.
- Mantenha IDs de AC estáveis; não renumerar sem atualizar o JSON.
- Não adicione checkbox nem status no Markdown.
- Atualize `Última atualização` na spec quando o conteúdo mudar.

## Passo 4 — Atualizar checklist (JSON)

- Alinhe `status` de cada AC com a auditoria.
- Ao mudar um AC para `done`, identifique um commit **já existente** que tornou o critério atendido e preencha `completedCommit` (hash completo via `git rev-parse <ref>^{commit}`). A data/hora de conclusão é herdada desse commit.
- Ao retirar um AC de `done`, remova `completedCommit`.
- Adicione ACs faltantes no JSON (e na spec) se o código entregou critérios não documentados.
- Remova ou marque fora de escopo na spec antes de remover do checklist.
- Valide `before` / `after` — ajuste se dependências mudaram.
- Atualize `updatedAt` (formato `YYYY-MM-DD`).

O commit que atualiza o checklist não pode referenciar o próprio hash; `completedCommit` aponta para um commit anterior da implementação.

## Passo 5 — Rastrear commits e validar conclusões

Varra **todos** os ACs com `status: "done"` (incluindo os que já estavam `done` antes da auditoria).

Para cada AC `done` **sem** `completedCommit`, ou com hash inválido/inexistente:

1. **Buscar evidência** no repositório:
   - `git log --oneline -- <paths>` nos arquivos que implementam o critério
   - commit de PR/issue em `prs` / `issues`
   - commit único e inequívoco no histórico da feature
2. **Backfill** — se a evidência for confiável, preencher `completedCommit` com `git rev-parse <ref>^{commit}` (minúsculas).
3. **Corrigir violação** — se não houver evidência confiável:
   - implementação verificável no código → rebaixar para `in-progress` e reportar
   - implementação incerta → rebaixar para `todo` e reportar
   - **não** manter `done` sem `completedCommit`
4. **Validar hashes** — `git cat-file -e <hash>^{commit}` para cada `completedCommit`.
5. **Confirmar invariante** — ao terminar, zero ACs `done` sem `completedCommit` válido.

## Passo 6 — Resumo

Entregue:

1. Tabela spec → ACs alterados (status anterior → novo).
2. Tabela de metadados: ACs com `completedCommit` preenchido, backfilled ou rebaixados por falta de commit.
3. Specs/docs criados ou editados.
4. Gaps: código sem spec, spec sem código, ACs bloqueados por dependência, ACs `done` sem commit rastreável.
5. Confirmação: `N` ACs `done`, todos com `completedCommit` válido.
6. Não commitar unless o usuário pedir.
