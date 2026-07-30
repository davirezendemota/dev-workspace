# 013 Projects · Plans

> **Última atualização:** 2026-07-30

---

## 1. Contexto e problema

**Milestones** definem escopo futuro (título, notas, specs vinculadas), mas não materializam
**como** implementar — ordem dos passos, referência a ACs e dependências entre etapas.
Agentes e humanos precisam re-derivar o plano a cada sessão.

## 2. Objetivo

O usuário cria ou gera um **plano de ação** vinculado a uma milestone, com passos ordenados
que referenciam specs/ACs do checklist, consumível pela UI e pela skill `dev-workspace`.

## 3. Escopo

### Dentro do escopo

- Entidade **`plans[]`** separada no JSON do projeto (abordagem B), com `milestoneId`
- API `GET` e `PUT /api/projects/{id}/plans`
- API `POST /api/projects/{id}/plans/generate` — gera plano via IA (adiciona à lista; não substitui)
- **Vários planos** por milestone, ordenados do mais recente ao mais antigo
- Campo `content` (texto do plano) + `items[]` estruturados (passos)
- UI na aba **Planos** do modal (`ProjectPlans`) e componente reutilizável `PlanExpandableList`
- Skill `dev-workspace`: endpoint e formatação ASCII para consumo por agentes

### Fora do escopo

- Editar spec-checklist ou markdown de specs pelo plano
- Sincronizar status do plano automaticamente com ACs do checklist
- Histórico de versões de plano (regenerar substitui o plano da milestone)
- Planos sem milestone vinculada

## 4. Requisitos

### Funcionais

- **RF1:** Modal exibe aba **Planos** para todos os tipos de projeto.
- **RF2:** `GET /api/projects/{id}/plans` retorna lista; ausente → `[]`.
- **RF3:** `PUT /api/projects/{id}/plans` valida e persiste no JSON local.
- **RF4:** Item tem `id` (único no projeto), `milestoneId`, **`title`** no padrão **`PXXX - nome`** (`P` + 3 dígitos + ` - ` + nome; código `PXXX` único no projeto), `source`, `generatedAt`, `content`, `items[]`.
- **RF5:** Passo tem `id`, `order`, `title`, `description`, `specRef?`, `dependsOn[]`, `status`.
- **RF6:** Vários planos podem referenciar o mesmo `milestoneId`.
- **RF7:** `POST .../plans/generate` com `{ milestoneId }` adiciona plano via IA (não substitui anteriores).
- **RF8:** Remover milestone remove planos vinculados (cascade na UI ao salvar milestones).

### Não-funcionais

- **RNF1:** Falha ao carregar/salvar/gerar não quebra o modal.
- **RNF2:** Geração exige IA configurada; retorna 400 se ausente.
- **RNF3:** `title` obrigatório no padrão `PXXX - nome`; `PXXX` único no projeto; nome após ` - ` não vazio.
- **RNF4:** Agentes consumidores: tasks via API **somente leitura** (`GET`); plano aprovado deve ser persistido via `PUT plans`.

## 5. Fluxo / Comportamento esperado

1. Usuário abre aba **Planos** → lista agrupada por milestone ou lista única (mais recente primeiro).
2. Clica **Expandir** → exibe o texto do plano (`content` ou passos formatados).
3. Agente elabora plano → usuário **aprova** → agente **cadastra** no DW (`PUT .../plans`) com **`id` único** e informa o `id` ao usuário para referência no agent-cli.
4. Agente no consumidor: `GET plans` + filtrar por `milestoneId` → seguir plano; **não** atualizar tasks via API.

## 6. Critérios de aceite

- **AC1:** Dado qualquer tipo de projeto, quando o modal abre, então a aba Planos está disponível.
- **AC2:** Dado projeto sem planos, quando a API é consultada, então retorna lista vazia.
- **AC3:** Dado milestone com specs, quando gera plano com IA configurada, então plano é criado com passos ordenados e `milestoneId` correto.
- **AC4:** Dado vários planos na mesma milestone, quando a UI lista, então ordena do mais recente ao mais antigo.
- **AC5:** Dado plano na lista, quando expandir, então exibe o texto do plano.
- **AC6:** Skill documenta cadastro de plano aprovado via `PUT plans` e tasks somente leitura (`GET`, sem `PUT`).

## 8. API

- `GET /api/projects/{id}/plans` → `{ version: 1, items: Plan[], updated_at }`
- `PUT /api/projects/{id}/plans` → documento validado e gravado
- `POST /api/projects/{id}/plans/generate` → `{ milestoneId }` → plano gerado

```json
{
  "version": 1,
  "items": [
    {
      "id": "plan01",
      "milestoneId": "ms-abc",
      "title": "P001 - Módulo Tinder",
      "source": "ai",
      "generatedAt": "2026-07-30T12:00:00.000Z",
      "content": "1. Discovery…\n\n2. Match…",
      "items": [
        {
          "id": "step1",
          "order": 1,
          "title": "Discovery: swipe e curtida",
          "description": "Feed e ações like/pass",
          "specRef": { "specId": "004", "ac": "AC1" },
          "dependsOn": [],
          "status": "todo"
        }
      ]
    }
  ]
}
```
