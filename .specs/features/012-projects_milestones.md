# 012 Projects · Milestones

> **Última atualização:** 2026-08-18

---

## 1. Contexto e problema

**Checkpoints** registram reuniões com stakeholders e entregas já ocorridas (histórico).
O planejamento futuro — specs que **serão** implementadas — precisa de um lugar próprio,
sem misturar com o que já foi feito.

**Milestones** são checkpoints de planejamento: marcos futuros vinculados a specs do
`spec-checklist.json`, não a checkpoints anteriores.

## 2. Objetivo

O usuário abre o modal do projeto, gerencia milestones (criar, editar, remover) e associa
cada milestone a uma ou mais specs planejadas.

## 3. Escopo

### Dentro do escopo

- Aba **Milestones** no `ProjectDetailModal`
- CRUD de milestones com persistência no JSON do projeto (`milestones` embutido)
- API `GET` e `PUT /api/projects/{id}/milestones`
- Vínculo **milestone ↔ specs** (`specIds` referenciando `specId` do checklist)
- Timeline visual orientada ao futuro (por `targetDate`)
- Ação opcional em checkpoint: **Planejar milestone** (copia título/resumo; sem FK)

### Fora do escopo

- Vínculo obrigatório ou persistido entre checkpoint e milestone
- Edição do spec-checklist pela aba Milestones (somente seleção de specs existentes)
- Milestones no card compacto da listagem
- Milestones no repositório remoto (GitHub)

## 4. Requisitos

### Funcionais

- **RF1:** Modal exibe aba Milestones para todos os tipos de projeto.
- **RF2:** `GET /api/projects/{id}/milestones` retorna lista; ausente → `[]`.
- **RF3:** `PUT /api/projects/{id}/milestones` valida e persiste no JSON local.
- **RF4:** Item tem `id`, `title`, `targetDate` (opcional), `description` (opcional), `specIds[]`.
- **RF5:** UI lista specs disponíveis do `GET /api/projects/{id}/spec-checklist` para vincular.
- **RF6:** Checkpoint pode disparar criação de milestone com título/resumo pré-preenchidos (sem salvar vínculo).

### Não-funcionais

- **RNF1:** Falha ao carregar/salvar não quebra o modal.
- **RNF2:** `title` obrigatório após trim; `specIds` validados como strings não vazias.

## 5. Fluxo / Comportamento esperado

1. Usuário abre aba Milestones → `GET milestones` + spec-checklist para picker.
2. Adiciona milestone com título, data alvo opcional, notas e specs vinculadas.
3. Lista ordenada por `targetDate` (mais próximo primeiro; sem data no final).
4. Em Checkpoints, botão **Planejar milestone** abre a aba Milestones com formulário pré-preenchido.

## 6. Critérios de aceite

- **AC1:** Dado qualquer tipo de projeto, quando o modal abre, então a aba Milestones está disponível.
- **AC2:** Dado projeto sem milestones, quando a API é consultada, então retorna lista vazia.
- **AC3:** Dado CRUD em projeto manual, quando o usuário salva, então `milestones` persiste após recarregar.
- **AC4:** Dado specs no checklist, quando o usuário vincula `specIds`, então a UI exibe títulos das specs associadas.
- **AC5:** Dado checkpoint com título, quando o usuário clica Planejar milestone, então a aba Milestones abre com título/descrição pré-preenchidos sem criar vínculo com o checkpoint.
- **AC6:** Dado `PUT` com `title` vazio, então a API retorna 400.

## 8. API

- `GET /api/projects/{id}/milestones` → `{ version: 1, items: Milestone[], updated_at }`
- `PUT /api/projects/{id}/milestones` → documento validado e gravado

```json
{
  "version": 1,
  "items": [
    {
      "id": "abc123",
      "title": "Q4 — Auth refresh",
      "targetDate": "15/10/2026",
      "description": "Planejado após alinhamento com cliente.",
      "specIds": ["013", "014"]
    }
  ]
}
```
