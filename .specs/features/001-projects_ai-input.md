# 001 Projects · AI input

> **Última atualização:** 2026-07-25

---

## 1. Contexto e problema

Na aba Projects, o usuário precisa interagir com um agente sem sair da visão
dos projetos. A resposta da IA pode mencionar um projeto específico; o usuário
precisa localizar esse card na lista sem perder o contexto da conversa.

## 2. Objetivo

O usuário descreve uma tarefa ou pergunta em linguagem natural na aba Projects
e recebe uma resposta do agente, usando a configuração de IA definida em
Settings. Quando a resposta referencia um projeto, o sistema indica qual card
foi identificado e rola a lista até ele.

## 3. Escopo

### Dentro do escopo
- Painel de prompt acima dos cards de projeto (input + botão enviar + Enter)
- Área “Resposta do agente” (skeleton vazio ou texto)
- Integração via API Route do Next.js usando provider, modelo e token de Settings
- Estados de loading e erro
- Detecção de projeto referenciado na resposta (`referenced_project_id`)
- Aviso persistente com nome do projeto referenciado
- Scroll automático até o card do projeto referenciado

### Fora do escopo
- Seleção de agente / aba Agents
- Streaming token a token
- Histórico persistente de conversas
- Anexos, `@projeto`, comandos slash
- Edição do resumo AI nos cards (`project.ai`)
- Destaque visual temporário (border/glow) no card do projeto

## 4. Requisitos

### Funcionais
- **RF1:** Exibir campo de texto com placeholder na aba Projects.
- **RF2:** Enviar prompt via botão ou Enter; envio vazio é ignorado.
- **RF3:** Exibir resposta do agente na área abaixo do input.
- **RF4:** Usar config de IA (provider, modelo, token) salva em Settings.
- **RF5:** Quando a resposta referencia um projeto, exibir aviso com o nome do
  projeto abaixo do painel de resposta.
- **RF6:** Rolar a lista de cards até o projeto referenciado.
- **RF7:** Dispensar o aviso ao clicar em qualquer lugar da tela; limpar o aviso
  ao enviar nova pergunta.

### Não-funcionais
- **RNF1:** Token de API nunca trafega para o frontend além do formulário de Settings.
- **RNF2:** Mensagem de erro amigável quando IA não estiver configurada ou falhar.

## 5. Fluxo / Comportamento esperado

1. Usuário abre a aba Projects.
2. Digita no campo de prompt e envia (botão ou Enter).
3. Sistema exibe loading na área de resposta.
4. Sucesso: resposta exibida; input limpo.
5. Se a IA identificar um projeto específico (`referenced_project_id` na API ou
   menção no prompt), o sistema:
   - exibe aviso “Projeto referenciado: **{nome}**” abaixo do painel;
   - rola suavemente até o card correspondente;
   - mantém o aviso visível até o usuário clicar em qualquer lugar da tela.
6. Erro: mensagem amigável (IA não configurada, timeout, falha de API).
7. Vazio: skeleton na área de resposta até o primeiro envio.

## 5b. Comportamento do modelo (IA)

- **Entrada:** texto livre do usuário.
- **Config:** `ai_provider`, `ai_model`, `ai_api_token` de Settings ([[002-settings]]).
- **Saída esperada:** JSON com `answer` (texto da resposta) e
  `referenced_project_id` (id do projeto ou `null`).
- **Fallback de referência:** se `referenced_project_id` vier `null`, tentar
  detectar projeto pelo nome ou cliente mencionado no prompt do usuário.
- **Fallback de erro:** se Settings incompleto ou API falhar, exibir erro sem
  quebrar a tela. Ver também listagem de projetos em [[003-projects]].

## 6. Critérios de aceite

- **AC1:** Dado que o usuário está na aba Projects, quando a tela carrega, então o painel de AI input é exibido acima dos cards.
- **AC2:** Dado um prompt válido e IA configurada, quando o usuário envia, então a resposta do agente é exibida na área de resposta.
- **AC3:** Dado falha ou IA não configurada, quando o usuário envia, então uma mensagem de erro amigável é exibida.
- **AC4:** Dado envio com campo vazio, quando o usuário tenta enviar, então nada é disparado.
- **AC5:** Dado que a resposta referencia um projeto específico, quando a resposta é exibida, então um aviso com o nome do projeto aparece abaixo do painel e a lista rola até o card correspondente.
- **AC6:** Dado o aviso de projeto referenciado visível, quando o usuário clica em qualquer lugar da tela, então o aviso é dispensado.

## 7. Decisões e alternativas consideradas

| Decisão | Alternativas descartadas | Motivo |
|---------|--------------------------|--------|
| Painel só na aba Projects | Input global em todas as tabs | Alinhado ao wireframe |
| Config de IA em Settings | Seleção de provider no próprio prompt | Centraliza credenciais e evita reconfigurar por uso |
| API Route do Next.js (fullstack na raiz) | Backend separado | App unificado; credenciais ficam no servidor |
| Resposta única (sem streaming) | Streaming | Implementação inicial mais simples |
| Aviso persistente até clique | Border/glow temporário no card (5s) | Menos ruído visual; usuário controla quando dispensar |
| `referenced_project_id` no JSON da IA | Parsing livre só no texto da resposta | Identificação confiável do card alvo |

## 8. Riscos e questões em aberto

- Rate limit e timeout ainda não definidos.
- Detecção por nome/cliente no prompt (fallback) pode gerar falso positivo em nomes ambíguos.

**API:**

- `POST /api/projects/ask` → `{ prompt: string }` retorna `{ answer, referenced_project_id }`
