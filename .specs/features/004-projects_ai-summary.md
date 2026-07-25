# 004 Projects · AI summary

> **Última atualização:** 2026-07-25

---

## 1. Contexto e problema

Os cards de projeto na aba Projects exibem um bloco de IA com o campo `ai` do
JSON. Sem geração automática, esse texto fica estático ou vazio, e o usuário
não tem visão rápida do estado atual de cada projeto (pendências, specs, contexto
do repositório).

## 2. Objetivo

Cada card de projeto exibe um resumo curto gerado por IA com base nos dados do
projeto, atualizado automaticamente quando desatualizado (>24h) e sob demanda
pelo usuário.

## 3. Escopo

### Dentro do escopo
- Bloco de resumo IA no card (`ProjectAiSummary`)
- Geração via IA usando provider, modelo e token de Settings (spec 002)
- Contexto: campos do JSON do projeto + specs/ACs do bloco `projects[]` correspondente ao projeto em `spec-checklist.json` (resolução via `spec_project_id` e heurísticas — mesma lógica da spec 006), não o arquivo inteiro do checklist
- Persistência do resumo no campo `ai` do `{slug}.json`
- Timestamp `_meta.ai_updated_at` para controle de staleness
- Atualização imediata ao criar projeto GitHub (`POST /api/projects` com `source_type: github`)
- Atualização automática em background ao listar projetos (`GET /api/projects`) para resumos com >24h
- Atualização forçada via botão no card (`POST /api/projects/{id}/ai-summary`)
- UI: máximo 2 linhas, chevron para expandir overflow, skeleton durante refresh manual
- Prompt de sistema configurável (`ai_project_summary_prompt` em Settings, com default em código)

### Fora do escopo
- Cron externo / endpoint dedicado de rotina
- Streaming do resumo token a token
- Edição manual do texto do resumo na UI
- Histórico de versões anteriores do resumo
- Auth nos endpoints de geração

## 4. Requisitos

### Funcionais
- **RF1:** O card deve exibir o valor de `json_data.ai` (fallback: "Sem resumo ainda…").
- **RF2:** A IA deve gerar resumo em português, curto (até ~2 frases), com base apenas nos dados fornecidos.
- **RF3:** Ao gerar, gravar `ai` no JSON do projeto e `ai_updated_at` em `_meta`.
- **RF4:** Considerar resumo desatualizado se vazio, placeholder ou `ai_updated_at` >24h.
- **RF5:** `GET /api/projects` dispara em background a atualização de resumos desatualizados (sem bloquear a resposta).
- **RF6:** `POST /api/projects/{id}/ai-summary` força geração imediata e retorna o projeto atualizado.
- **RF7:** No hover do bloco, exibir botão de atualizar resumo.
- **RF8:** Durante refresh manual, substituir o texto por skeleton (`AiResponseSkeleton`).
- **RF9:** Texto recolhido limitado a 2 linhas; chevron expande/recolhe quando há overflow.
- **RF10:** Usar `ai_project_summary_prompt` de Settings quando preenchido; senão, prompt padrão.
- **RF11:** O contexto enviado à IA deve incluir apenas o bloco `projects[]` resolvido para o projeto (id, nome, specs e ACs), nunca o `spec-checklist.json` completo do repositório.

### Não-funcionais
- **RNF1:** Token de API nunca expõe no frontend.
- **RNF2:** Falha na geração automática não impede listagem de projetos.
- **RNF3:** Contexto enviado à IA truncado (~6000 caracteres) para evitar payloads excessivos.
- **RNF4:** IA não configurada: refresh manual retorna 400 com mensagem amigável; refresh automático é ignorado.

## 5. Fluxo / Comportamento esperado

### Exibição no card
1. Usuário abre a aba Projects.
2. Cards renderizam o bloco IA com ícone spark, texto em itálico e ações à direita.
3. Texto ocupa no máximo 2 linhas; se ultrapassar, chevron permite expandir/recolher.

### Atualização automática
1. Frontend chama `GET /api/projects`.
2. API retorna a lista imediatamente.
3. Em background, para cada projeto com resumo desatualizado (>24h ou vazio), a API gera novo resumo se IA estiver configurada.
4. Na próxima listagem ou refresh manual, o card reflete o texto atualizado.

### Atualização manual
1. Usuário passa o mouse sobre o bloco IA → botão de atualizar aparece.
2. Usuário clica em atualizar.
3. Texto é substituído por skeleton; ícone de refresh gira.
4. `POST /api/projects/{id}/ai-summary` gera e persiste o resumo.
5. Sucesso: skeleton some e novo texto é exibido; estado do card é atualizado.
6. Erro: skeleton some e texto anterior permanece.

**Estados:** texto normal; expandido; loading (skeleton); vazio/placeholder; erro silencioso no refresh manual (mantém texto anterior).

## 5b. Comportamento do modelo (IA)

- **Entrada:** JSON com dados do card + `spec_checklist` filtrado ao projeto (bloco `projects[]` resolvido via `spec_project_id`/heurísticas em `.specs/spec-checklist.json` do repositório vinculado, quando disponível). Outros projetos no mesmo arquivo de checklist são excluídos do contexto.
- **System prompt:** `ai_project_summary_prompt` (Settings) ou default (`project-ai-summary-prompt.ts`).
- **Saída esperada:** texto plano do resumo, sem JSON/markdown.
- **Persistência:** campo `ai` + `_meta.ai_updated_at`.

## 6. Critérios de aceite

- **AC1:** Dado um projeto com campo `ai` preenchido, quando o card é renderizado, então o bloco IA exibe esse resumo.
- **AC2:** Dado resumo com mais de 2 linhas visuais, quando o card é exibido, então o chevron permite expandir e recolher o texto.
- **AC3:** Dado hover no bloco IA, quando o usuário posiciona o cursor, então o botão de atualizar resumo fica visível.
- **AC4:** Dado clique em atualizar, quando a requisição está em andamento, então o texto é substituído por skeleton até a resposta.
- **AC5:** Dado IA configurada, quando o usuário força atualização, então `POST /api/projects/{id}/ai-summary` grava novo texto em `ai` e atualiza `ai_updated_at`.
- **AC6:** Dado resumo com mais de 24h (ou vazio), quando `GET /api/projects` é chamado, então resumos desatualizados são regenerados em background.
- **AC7:** Dado IA não configurada, quando o usuário força atualização, então a API retorna erro 400 com mensagem amigável e o card não quebra.
- **AC8:** Dado prompt customizado em Settings, quando um resumo é gerado, então a IA usa esse prompt como system prompt.
- **AC9:** Dado um `spec-checklist.json` com múltiplos projetos em `projects[]`, quando o resumo é gerado, então o contexto inclui apenas specs/ACs do bloco resolvido para aquele projeto, excluindo entradas de outros projetos no mesmo arquivo.

## 7. Decisões e alternativas consideradas

| Decisão | Alternativas descartadas | Motivo |
|---------|--------------------------|--------|
| Campo `ai` no JSON do projeto | Campo separado em banco | Alinha à fonte da verdade em disco (spec 003) |
| Staleness de 24h | Atualizar sempre / cron externo | Equilíbrio entre frescor e custo de API |
| Refresh em background no `GET /api/projects` | Cron dedicado + `CRON_SECRET` | Simplicidade operacional; sem infra extra |
| Contexto com bloco `projects[]` resolvido do checklist | Arquivo `spec-checklist.json` inteiro / apenas JSON do card | Resumo focado no projeto sem ruído de outros projetos no mesmo repo |
| Skeleton no refresh manual | Spinner só no ícone | Consistência com AI input da aba Projects (spec 001) |
| `_meta.ai_updated_at` | Só `mtime` do arquivo | Controle explícito sem confundir com outras edições |

## 8. Riscos e questões em aberto

- Projetos sem repo local ou sem match em `projects[]` não terão specs/ACs no contexto (apenas dados do JSON do card).
- Checklists monorepo com vários `projects[]` exigem `spec_project_id` correto para resolver o bloco certo.
- Refresh em background pode gerar custo de API ao abrir Projects com muitos projetos desatualizados.
- Card não atualiza em tempo real após refresh automático em background (requer nova listagem).
- Rate limit e timeout da API de IA ainda não definidos.
- Prompt customizado sem validação semântica — usuário pode degradar qualidade do resumo.

**API:**

- `POST /api/projects/{id}/ai-summary` → gera resumo e retorna projeto atualizado
- `GET /api/projects` → lista projetos e dispara refresh de resumos >24h em background

**Formato persistido (trecho):**

```json
{
  "ai": "2 specs com ACs pendentes; último checkpoint em 20/07.",
  "_meta": {
    "ai_updated_at": "2026-07-25T03:15:00.000Z"
  }
}
```
