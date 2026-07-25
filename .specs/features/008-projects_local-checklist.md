# 008 Projects · Checklist local simples

> **Última atualização:** 2026-07-25

---

## 1. Contexto e problema

Projetos Manual (`source_type: "local"`) não têm repositório e, portanto, não
possuem `.specs/spec-checklist.json`. O dashboard de specs (spec 006) fica vazio
para esses projetos, mas o usuário ainda precisa de um checklist editável para
acompanhar tarefas simples.

## 2. Objetivo

O usuário abre o modal de um projeto Manual e gerencia um checklist booleano
simples — adicionar, renomear, remover e marcar itens — persistido em um arquivo
sidecar ao lado do JSON do projeto.

## 3. Escopo

### Dentro do escopo
- Aba **Checklist** no `ProjectDetailModal`, visível somente para `source_type: "local"`
- CRUD completo de itens: adicionar, renomear, remover e marcar/desmarcar
- Persistência em `{projects_folder}/{project-id}.spec-checklist.json`
- API `GET` e `PUT /api/projects/{id}/local-checklist`
- Arquivo ausente → checklist vazio
- Exclusão do sidecar ao remover o projeto
- Sidecars excluídos da listagem de projetos (`GET /api/projects`)

### Fora do escopo
- Issues, PRs, commits ou metadados de conclusão
- Specs, critérios de aceite (`ACn`) ou status além de booleano
- Checklist editável para `local_repo` ou `github` (permanece leitura via spec 006)
- Sincronização do sidecar com repositórios externos
- Exibição do sidecar no card compacto da listagem

## 4. Requisitos

### Funcionais
- **RF1:** Modal de projeto Manual exibe aba Checklist além de Dashboard.
- **RF2:** `GET /api/projects/{id}/local-checklist` retorna o documento; arquivo ausente → `{ version: 1, items: [] }`.
- **RF3:** `PUT /api/projects/{id}/local-checklist` valida e sobrescreve o documento inteiro.
- **RF4:** Itens têm `id` único, `label` (string não vazia) e `done` (boolean estrito).
- **RF5:** Endpoints rejeitam projetos que não sejam `source_type: "local"`.
- **RF6:** Remover o projeto também remove o sidecar, se existir.
- **RF7:** Arquivos `*.spec-checklist.json` não aparecem em `GET /api/projects`.

### Não-funcionais
- **RNF1:** Escrita atômica (arquivo temporário + rename).
- **RNF2:** Label com no máximo 200 caracteres após `trim()`.
- **RNF3:** UI serializa salvamentos para evitar sobrescrita concorrente.

## 5. Fluxo / Comportamento esperado

### Abrir aba
1. Usuário abre o modal de um projeto Manual.
2. Navega para a aba Checklist.
3. Frontend chama `GET /api/projects/{id}/local-checklist`.
4. Lista os itens ou estado vazio.

### Editar
1. Usuário adiciona, renomeia, remove ou marca um item.
2. Frontend envia `PUT` com o documento completo.
3. Controles ficam desabilitados durante o salvamento.
4. Sucesso atualiza a lista; erro exibe mensagem amigável.

### Remover projeto
1. `DELETE /api/projects/{id}` remove `{id}.json` e `{id}.spec-checklist.json`.

**Estados:** loading; vazio; sucesso com itens; salvando; erro.

## 6. Critérios de aceite

- **AC1:** Dado um projeto Manual, quando o modal abre, então a aba Checklist está disponível; projetos `local_repo` e `github` não a exibem.
- **AC2:** Dado sidecar ausente, quando a API é consultada, então retorna `{ version: 1, items: [] }`.
- **AC3:** Dado adicionar, renomear ou remover um item, quando o usuário salva, então o sidecar é atualizado e persiste após recarregar.
- **AC4:** Dado marcar/desmarcar um item, quando o usuário salva, então o booleano `done` é persistido no sidecar.
- **AC5:** Dado um arquivo `{id}.spec-checklist.json`, quando `GET /api/projects` lista projetos, então esse arquivo não aparece como projeto.
- **AC6:** Dado projeto `local_repo` ou `github`, quando a API de local-checklist é chamada, então responde com erro 400.
- **AC7:** Dado um projeto Manual com sidecar, quando o projeto é removido, então o sidecar também é excluído.

## 7. Decisões e alternativas consideradas

| Decisão | Alternativas descartadas | Motivo |
|---------|--------------------------|--------|
| Sidecar `{id}.spec-checklist.json` | Campo no JSON principal; pasta `.specs/` do workspace | Isola checklist editável sem poluir o card JSON nem o formato de specs |
| Documento simples `items[]` | Reutilizar schema de ACs do `.specs` | Projetos sem repo não precisam de specs/commits/issues |
| PUT do documento inteiro | PATCH por item | Evita corridas parciais e simplifica validação |
| Aba só para `local` | Checklist editável para todos | `local_repo`/`github` já usam spec-checklist do repositório |

## 8. Riscos e questões em aberto

- Salvamentos concorrentes rápidos podem sobrescrever; a UI deve serializar operações.
- Sidecars órfãos de exclusões anteriores à feature podem existir até limpeza manual.
- O checklist legado em `json_data.checklist` (card) permanece independente desta feature.

**Formato do sidecar:**

```json
{
  "version": 1,
  "items": [
    { "id": "a1b2c3d4", "label": "Definir escopo", "done": false },
    { "id": "e5f6g7h8", "label": "Enviar proposta", "done": true }
  ]
}
```

**API:**

- `GET /api/projects/{id}/local-checklist` → documento
- `PUT /api/projects/{id}/local-checklist` → documento validado e gravado
