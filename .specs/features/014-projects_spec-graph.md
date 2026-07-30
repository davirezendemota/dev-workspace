# 014 Projects · Spec graph (doc links)

> **Última atualização:** 2026-07-30

---

## 1. Contexto e problema

Specs em `.specs/features/*.md` descrevem features isoladas, mas relações conceituais
entre documentos (referência, extensão, “ver também”) ficam só em texto livre.
Não há grafo navegável de documentação — apenas dependências de **entrega**
(`before`/`after` no checklist), que servem a outro propósito.

## 2. Objetivo

O usuário menciona specs via wikilinks estilo Obsidian no Markdown e visualiza o
**grafo de relações documentais** na primeira aba do modal do projeto, com navegação
para a feature citada.

## 3. Escopo

### Dentro do escopo

- Sintaxe wikilink no Markdown: `[[002]]`, `[[002-settings]]`, `[[002#AC5]]`, `[[002|Settings]]`
- Parser server-side e backlinks calculados a partir do conteúdo das specs
- API `GET /api/projects/{id}/spec-graph` (nós, arestas doc-only, `brokenLinks`)
- Aba **Grafo** como **primeira** aba do `ProjectDetailModal` (default ao abrir)
- Visualização force-directed 2D (zoom/pan, tamanho de nó por grau, profundidade local)
- Clique no nó abre a aba **Features** com a spec selecionada
- Wikilinks clicáveis na leitura Markdown da aba Features

### Fora do escopo

- Dependências de entrega (`before` / `after` do checklist)
- Milestones `specIds`, planos `specRef`, status de ACs como arestas do grafo
- Edição de links pela UI (somente no `.md`)
- Persistência de posições dos nós
- Âncora com scroll automático até RF/AC na spec alvo (v1.1)

## 4. Requisitos

### Funcionais

- **RF1:** Wikilinks `[[NNN]]`, `[[NNN-slug]]`, `[[NNN#âncora]]` e `[[NNN|label]]` são parseados e resolvidos para `specId` do checklist.
- **RF2:** `GET /api/projects/{id}/spec-graph` retorna nós (todas as specs), arestas agregadas de menções e `brokenLinks`.
- **RF3:** Aresta existe somente quando o alvo existe no checklist; self-loops são ignorados.
- **RF4:** Modal exibe aba **Grafo** como primeira aba e a abre por default.
- **RF5:** Grafo force-directed com zoom/pan, tamanho de nó proporcional a conexões, slider de profundidade (0–3) a partir do nó selecionado.
- **RF6:** Clique no nó abre Features com a spec correspondente.
- **RF7:** Na leitura da spec, wikilinks viram links; alvo inexistente usa estilo de aviso.

### Não-funcionais

- **RNF1:** Falha ao carregar o grafo não quebra o modal.
- **RNF2:** Arestas do grafo **não** incluem `before`/`after`, milestones nem planos.
- **RNF3:** Canvas do grafo não é renderizado no SSR (import dinâmico).

## 5. Fluxo / Comportamento esperado

1. Autor escreve `[[002-settings]]` (ou variante) no `.md` de outra spec.
2. Usuário abre o modal do projeto → aba **Grafo** (primeira) carrega o endpoint.
3. Nós = specs do checklist; arestas = menções no Markdown.
4. Hover destaca vizinhos; slider filtra profundidade local a partir do nó selecionado.
5. Clique no nó → aba Features com a spec selecionada.
6. Na Features, clique em wikilink → seleciona a spec alvo na sidebar.

## 6. Critérios de aceite

- **AC1:** Dado Markdown com `[[002]]`, `[[002-settings]]` ou `[[002#AC5]]`, quando o parser roda, então resolve para `specId` `"002"` (e âncora quando houver).
- **AC2:** Dado projeto com specs e wikilinks válidos/inválidos, quando `GET .../spec-graph` é chamado, então retorna nós, arestas doc-only e `brokenLinks` (sem arestas de entrega).
- **AC3:** Dado modal do projeto aberto, quando carrega, então a aba Grafo é a primeira e está ativa por default.
- **AC4:** Dado grafo com nós e arestas, quando o usuário interage, então há zoom/pan, tamanho de nó ∝ conexões e filtro de profundidade local.
- **AC5:** Dado nó no grafo, quando o usuário clica, então a aba Features abre com a spec selecionada.
- **AC6:** Dado Markdown com wikilink na Features, quando renderiza, então o link é clicável; alvo inexistente aparece com estilo de aviso.

## 7. Decisões e alternativas consideradas

| Decisão | Alternativas descartadas | Motivo |
|---------|--------------------------|--------|
| Wikilinks no `.md` como fonte | Campo `relatedSpecs` no checklist | Mantém documentação no texto; evita duplicar |
| Arestas só documentais | Misturar `before`/`after` no mesmo grafo | Entrega ≠ documentação |
| `react-force-graph-2d` | D3 manual / Obsidian embed | Canvas force-directed pronto, SSR-safe com dynamic import |
| Clique no nó → Features | Só highlight no grafo | Navegação direta ao conteúdo |

Relaciona-se documentalmente com o modal de projeto ([[006-projects_modal-dashboard]])
e a leitura de features ([[006]]). Não mistura arestas com entrega (`before`/`after`).

## 8. Riscos e questões em aberto

- Projetos GitHub: leitura de todos os `.md` pode ser lenta (N requests); mitigar com cache futuro se necessário.
- Âncoras `#RF`/`#AC` resolvem no parser, mas scroll até a âncora fica para v1.1.
