# /new-spec

Crie uma **nova spec** em `.specs/features/` e registre em `spec-checklist.json`.

Detalhes do usuário (título, módulo, escopo, ACs): `$ARGUMENTS` ou texto após o comando.

## Referências

- `.specs/spec-template.md`
- `.specs/README.md` (convenção de nomes)
- `.specs/spec-checklist.json`

## Passo 1 — Coletar informações

Se `$ARGUMENTS` não basta, pergunte em uma rodada:

1. Título curto da feature.
2. Módulo/área (`settings`, `projects`, …).
3. Subfeature? (define `_{featureslug}` no nome do arquivo).
4. Critérios de aceite iniciais (lista para AC1, AC2, …).
5. Dependências (`after` / `before` em outras specs ou ACs).

## Passo 2 — Determinar `specId`

- Próximo ID = maior `specId` existente no checklist + 1, formato `NNN` (ex.: `004`).
- Não reutilizar IDs de specs removidas sem confirmar com o usuário.

## Passo 3 — Criar arquivo da spec

1. Copiar `spec-template.md` → `features/{specId}-{modulo}[_{featureslug}].md`.
2. Preencher todas as seções; usar `N/A` quando não aplicável.
3. Seção **6. Critérios de aceite**: `AC1`, `AC2`, … com formato Dado/Quando/Então quando possível.
4. **Sem** checkbox ou status no Markdown.

## Passo 4 — Registrar no checklist

No `projects[]` correto (default: primeiro projeto, ou o que o usuário indicar):

```json
{
  "specId": "004",
  "specFile": "features/004-modulo.md",
  "title": "...",
  "after": [],
  "before": [],
  "checklist": [
    {
      "ac": "AC1",
      "description": "...",
      "status": "todo",
      "issues": [],
      "prs": []
    }
  ]
}
```

- Um item de checklist por AC da spec.
- `before` / `after` na spec ou nos ACs conforme dependências declaradas.

## Passo 5 — Validar e resumir

- JSON válido contra `spec-checklist.schema.json`.
- IDs de AC no `.md` = IDs no JSON.
- Atualizar `updatedAt`.
- Resumir: caminho do arquivo, `specId`, ACs criados, dependências.
- Não commitar unless o usuário pedir.
