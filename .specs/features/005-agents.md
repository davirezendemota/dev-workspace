# 005 Agents

> **Última atualização:** 2026-07-25

---

## 1. Contexto e problema

O workspace precisa de agentes de IA configuráveis (prompts/instruções em
Markdown) persistidos em disco, separados dos projetos. Sem uma aba Agents, o
usuário não consegue criar, listar nem editar esses perfis de agente a partir
da interface.

## 2. Objetivo

O usuário gerencia agentes como arquivos `{slug}.md` na pasta configurada em
Settings, com listagem, busca, criação, edição e remoção pela aba Agents.

## 3. Escopo

### Dentro do escopo
- Aba Agents no dashboard
- Listagem lendo `*.md` da pasta `agents_folder` (Settings, spec 002)
- Busca por nome na aba
- Cards com nome, arquivo, excerpt e data de atualização
- Modal “Adicionar agente” com nome e conteúdo Markdown
- Modal de detalhe para editar nome/conteúdo e remover agente
- Editor Markdown com alternância código/preview (`AgentMarkdownField`)
- API `GET/POST /api/agents`, `GET/PUT/DELETE /api/agents/{id}`
- `id` = stem do arquivo (`dev-fullstack` para `dev-fullstack.md`)
- Nome exibido extraído do heading `# Título` ou do slug do arquivo
- Normalização do conteúdo: garante heading `# {nome}` no topo
- Renomear agente (mudança de nome) gera novo arquivo por slug e remove o antigo
- Conflito 409 se slug já existir
- Volume Docker: agentes em `/data/agents` (host `./workspace_data/agents`)

### Fora do escopo
- Seleção de agente no AI input da aba Projects (spec 001)
- Execução/invocação do agente contra APIs de IA
- Versionamento ou histórico de edições
- Subpastas por agente
- Auth / autorização nos endpoints
- Import/export em lote
- Templates customizáveis além do default do modal de criação

## 4. Requisitos

### Funcionais
- **RF1:** Listar agentes a partir dos `*.md` na raiz de `agents_folder`.
- **RF2:** Criar agente com `name` (obrigatório) e `content` (Markdown opcional).
- **RF3:** Ao criar, gravar `{slug}.md` com heading `# {name}` e corpo normalizado.
- **RF4:** Exibir cards com nome, nome do arquivo, excerpt (primeira linha útil do Markdown) e `updated_at`.
- **RF5:** Filtrar cards por busca textual no nome (case-insensitive).
- **RF6:** Abrir modal de detalhe ao clicar no card; permitir editar nome e conteúdo.
- **RF7:** Salvar alterações via `PUT /api/agents/{id}`; renomear move o arquivo se o slug mudar.
- **RF8:** Remover agente via `DELETE /api/agents/{id}` (confirmação no frontend).
- **RF9:** Retornar 409 se já existir `{slug}.md` na criação ou renomeação.
- **RF10:** Editor Markdown com modos “código” e “preview”.

### Não-funcionais
- **RNF1:** Fonte da verdade = filesystem (`agents/*.md`), não banco.
- **RNF2:** Pasta padrão Docker `/data/agents` (host `./workspace_data/agents`).
- **RNF3:** Conteúdo completo do arquivo trafega na API (sem streaming).

## 5. Fluxo / Comportamento esperado

### Listagem
1. Usuário abre a aba Agents.
2. Frontend chama `GET /api/agents`.
3. API lê `*.md` em `agents_folder` e retorna a lista.
4. Cards renderizam nome, arquivo, excerpt e data; card “+” abre modal de criação.

### Busca
1. Usuário digita no campo de busca acima dos cards.
2. Lista filtra por nome (e id) em tempo real.
3. Estado vazio exibe mensagem quando nenhum agente corresponde.

### Criação
1. Usuário clica em “+” → modal “Adicionar agente”.
2. Preenche nome e conteúdo (template default pré-preenchido).
3. `POST /api/agents` com `{ name, content }`.
4. API grava `{slug}.md`, responde o agente criado.
5. Toast de sucesso; lista atualiza e modal fecha.

### Edição e remoção
1. Usuário clica em um card → modal de detalhe.
2. Edita nome e/ou Markdown; alterna código/preview no editor.
3. Salvar → `PUT /api/agents/{id}`; toast e lista atualizada.
4. Remover → confirmação → `DELETE /api/agents/{id}`; card some da lista.

**Estados:** loading na listagem; submitting nos modais; vazio sem agentes; erro com banner `role="alert"` + toast.

## 6. Critérios de aceite

- **AC1:** Dado arquivos `*.md` em `agents_folder`, quando o usuário abre Agents, então os cards correspondem a esses arquivos.
- **AC2:** Dado nome válido, quando o usuário cria um agente, então surge `{slug}.md` com heading `# {nome}` e conteúdo persistido.
- **AC3:** Dado um card de agente, quando o usuário clica, então o modal de detalhe abre com nome e conteúdo editáveis.
- **AC4:** Dado alteração de nome que muda o slug, quando o usuário salva, então o arquivo antigo é removido e o novo `{slug}.md` é criado.
- **AC5:** Dado confirmação de remoção, quando o usuário remove o agente, então o arquivo `.md` é excluído e o card desaparece da lista.
- **AC6:** Dado slug já existente, quando o usuário tenta criar ou renomear, então a API retorna 409.
- **AC7:** Dado texto na busca, quando o usuário filtra, então apenas agentes cujo nome corresponde permanecem visíveis.
- **AC8:** Dado o editor de conteúdo, quando o usuário alterna modo, então pode editar em código ou visualizar preview Markdown.

## 7. Decisões e alternativas consideradas

| Decisão | Alternativas descartadas | Motivo |
|---------|--------------------------|--------|
| Markdown em `agents/{slug}.md` | JSON ou banco | Alinha ao modelo “workspace em disco” (spec 003) |
| Nome via heading `#` | Campo separado no frontmatter | Arquivo legível e editável fora do app |
| Slug a partir do nome | ID arbitrário desvinculado do arquivo | Consistência com projetos (`{slug}.json`) |
| Renomear = novo arquivo + unlink | Editar in-place sem mudar slug | Slug reflete o nome atual |
| Template default no modal | Arquivo vazio | Acelera primeira configuração do agente |
| API Routes do Next.js (`/api/*`) | Backend separado | App fullstack na raiz do repositório |

## 8. Riscos e questões em aberto

- Integração futura com AI input (spec 001) ainda não definida.
- Auth nos endpoints `/api/agents` em produção.
- Renomear com referências externas ao `id` antigo pode quebrar links manuais.

**Formato do arquivo (exemplo):**

```markdown
# Dev Fullstack

## Identidade

Descreva o papel e o tom do agente.

## Stack principal

- Next.js
- TypeScript
```

**API:**

- `GET /api/agents` → lista a partir dos `*.md`
- `POST /api/agents` → `{ name: string, content?: string }`
- `GET|PUT|DELETE /api/agents/{id}` → `id` = slug do arquivo
