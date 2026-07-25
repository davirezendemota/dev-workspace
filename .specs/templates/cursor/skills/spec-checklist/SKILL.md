---
name: spec-checklist
description: Gerencia pendências do spec-checklist.json — iniciar, concluir, bloquear ACs e listar status por spec. Use quando o usuário pedir iniciar/concluir/bloquear uma tarefa ou AC de uma spec (ex. "inicie a tarefa AC2 da spec 003", "conclua AC1 da 002", "pendências da spec settings").
---

# Spec checklist — manipulação de pendências

Gerencia `.specs/spec-checklist.json` sem alterar o comportamento descrito em `features/*.md` (só status e links).

## Referências

- `.specs/README.md`
- `.specs/spec-checklist.json`
- `.specs/spec-checklist.schema.json`

## Interpretar o pedido

| Ação do usuário | `status` destino | Palavras-chave |
|-----------------|------------------|----------------|
| Iniciar | `in-progress` | inicie, comece, start, trabalhar em |
| Concluir | `done` | conclua, finalize, complete, marque como done |
| Bloquear | `blocked` | bloqueie, block, impedido |
| Reabrir | `todo` | reabra, volte para todo, desbloqueie |
| Listar | — | pendências, status, liste, o que falta |

**Spec** — resolver por: `specId` (`003`, `3` → `003`), título parcial (`settings`, `projects`), ou `specFile`.

**AC** — resolver por: `ACn`, número (`2` → `AC2`), ou match na `description`.

Se ambíguo, listar candidatos e pedir confirmação em uma linha.

## Antes de mudar status

1. Ler spec em `specFile` e item no checklist.
2. **Dependências `after`** — todos os pré-requisitos devem estar `done`:
   - String `AC1` → mesmo spec.
   - `{ "specId": "002", "ac": "AC3" }` → spec/AC explícito.
3. Se pré-requisito pendente → **não** iniciar; reportar o bloqueio e sugira ordem.
4. Para `done` → ler critério na spec; se implementação não verificada, avisar antes de marcar.
5. Para `done` → identificar o commit que tornou o critério atendido:
   - Preferir o commit informado pelo usuário ou vinculado ao PR.
   - Caso contrário, inspecionar `git status` e o histórico recente; usar o `HEAD` somente se ele contiver a implementação verificada.
   - Normalizar com `git rev-parse <ref>^{commit}` e armazenar o hash completo em minúsculo.
   - Se a implementação relevante ainda estiver sem commit, não marcar `done`; explicar que um commit da implementação precisa existir primeiro. Nunca criar commit sem pedido explícito.

## Ao executar ação

1. Atualizar `status` do AC no JSON.
2. Se iniciou implementação relacionada, ler a spec e seguir o fluxo de código do projeto.
3. Vincular `prs` / `issues` se o usuário mencionou números.
4. Ao mudar para `done`, preencher `completedCommit` com o hash completo do commit da implementação. A data/hora de conclusão é herdada desse commit e não é armazenada separadamente.
5. Ao mudar de `done` para qualquer outro status, remover `completedCommit`.
6. Não inventar metadados para itens históricos já concluídos; fazer backfill somente com evidência confiável.
7. Atualizar `updatedAt` (`YYYY-MM-DD`).
8. Validar JSON contra schema.

O commit que atualiza o checklist não pode referenciar o próprio hash. `completedCommit` aponta para um commit anterior que já tornou o AC atendido; a atualização do checklist é commitada depois.

## Resposta padrão

```markdown
## Spec {specId} — {title}
**AC{n}** ({description})
- Status: {anterior} → {novo}
- Conclusão: commit {completedCommit ou —} · data/hora do commit
- Dependências satisfeitas: sim/não (listar pendentes)
- Próximo AC sugerido: ...
```

Para listagem, tabela por spec: AC | status | description | deps pendentes.

## Restrições

- Não colocar status/checkbox em `features/*.md`.
- Não marcar `done` sem critério verificado ou confirmação explícita do usuário.
- Não marcar um novo `done` sem `completedCommit`.
- Não remover ACs do checklist sem alinhar a spec.

## Exemplos

**Usuário:** inicie a tarefa AC2 da spec 003  
→ `003` / `AC2` → checar `after` → `in-progress` → resumo + opcionalmente implementar.

**Usuário:** conclua AC3 da spec settings  
→ resolver spec `002` por título → `AC3` → `done` se critério OK.

**Usuário:** pendências da spec 001  
→ listar ACs com `todo`, `in-progress`, `blocked` e deps não satisfeitas.
