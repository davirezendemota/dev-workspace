# 002 Settings · Configurações do workspace

> **Última atualização:** 2026-07-25

---

## 1. Contexto e problema

O workspace precisa persistir preferências (pastas de projetos e agentes,
credenciais de IA e prompt do resumo de projetos) fora do banco, em
`config.json`. Sem uma tela de Settings, o usuário não consegue ajustar esses
valores nem habilitar o AI input e os resumos IA da aba Projects.

## 2. Objetivo

O usuário configura pastas de projetos e agentes, integração de IA (API, modelo
e token) e o prompt de sistema do resumo IA nos cards de projeto, com
persistência em `config.json` e uso automático pelas API Routes do Next.js.

## 3. Escopo

### Dentro do escopo
- Aba Settings no dashboard
- Form “Workspace”: `projects_folder` e `agents_folder`
- Form “IA”: provedor (API), modelo e API token
- Form “Resumo de projetos”: prompt de sistema (`ai_project_summary_prompt`)
- `GET` / `PUT /api/settings` com loading, erro e toast
- Validação de pasta (criação e escrita) nas API Routes
- `has_ai_token` no GET (nunca retornar o token)
- Prompt padrão embutido em código; override opcional em `config.json`
- Indicador “Padrão” / “Personalizado” e ação “Restaurar padrão” no form de resumo
- Propagação de `projects_folder` para criação de projetos locais
- Propagação de `agents_folder` para criação de agentes locais
- Uso do prompt efetivo na geração de resumos (spec 004)

### Fora do escopo
- Múltiplos perfis de IA
- Configuração de agentes (aba Agents)
- Tema, idioma, edição raw do JSON
- Auth / autorização
- Histórico de alterações de settings
- Edição do user prompt / contexto enviado à IA (apenas system prompt)
- Validação semântica do prompt customizado

## 4. Requisitos

### Funcionais
- **RF1:** Carregar e exibir settings atuais via `GET /api/settings`.
- **RF2:** Salvar `projects_folder` e `agents_folder` com validação de pasta.
- **RF3:** Salvar `ai_provider`, `ai_model` e `ai_api_token`.
- **RF4:** Exibir `config_path` somente leitura.
- **RF5:** Indicar se token já existe (`has_ai_token`) sem expor o valor.
- **RF6:** Exibir e editar `ai_project_summary_prompt` na seção “Resumo de projetos”.
- **RF7:** Retornar no GET o prompt padrão (`default_ai_project_summary_prompt`) e se há override (`uses_custom_ai_project_summary_prompt`).
- **RF8:** Salvar prompt customizado em `config.json`; string vazia restaura o padrão embutido.
- **RF9:** Validar tamanho máximo do prompt customizado (4000 caracteres).

### Não-funcionais
- **RNF1:** Token armazenado apenas no servidor (`config.json`).
- **RNF2:** Defaults via env no Docker (`/data/config.json`, `/data/projects`, `/data/agents`).
- **RNF3:** Prompt padrão versionado em código (`project-ai-summary-prompt.ts`), não em `config.json`.

## 5. Fluxo / Comportamento esperado

1. Usuário abre a aba Settings.
2. Sistema carrega settings (`GET /api/settings`) e exibe três formulários.
3. Usuário edita pastas, config de IA e/ou prompt de resumo.
4. Ao salvar cada seção, `PUT /api/settings` valida e persiste em `config.json`.
5. Sucesso: toast e estado atualizado; dashboard recebe novas pastas.
6. Erro: banner `role="alert"` + toast.

### Resumo de projetos
1. Textarea exibe o prompt customizado ou o padrão embutido.
2. Badge indica “Padrão” ou “Personalizado”.
3. “Restaurar padrão” preenche o textarea com o default (salvar persiste string vazia).
4. “Salvar prompt” grava `ai_project_summary_prompt` quando diferente do padrão.
5. Gerações de resumo (spec 004) usam o prompt efetivo imediatamente após salvar.

**Defaults Docker:** volume `./workspace_data` montado em `/data`:
- config: `/data/config.json` (host `./workspace_data/config.json`)
- projects: `/data/projects` (host `./workspace_data/projects`)
- agents: `/data/agents` (host `./workspace_data/agents`)

**Defaults locais (`npm run dev`):** `./workspace_data/...` via env ou fallback em
`process.cwd()/workspace_data`. Trocar pasta **não** move arquivos existentes.

## 6. Critérios de aceite

- **AC1:** Dado que o usuário abre Settings, quando a tela carrega, então os valores atuais de workspace e IA são exibidos.
- **AC2:** Dado pastas válidas, quando o usuário salva, então `projects_folder` e `agents_folder` são persistidos em `config.json`.
- **AC3:** Dado provider, modelo e token, quando o usuário salva, então a config de IA é persistida e usada pelo AI input e pelos resumos de projeto.
- **AC4:** Dado token já salvo, quando o usuário consulta settings, então `has_ai_token` é `true` e o valor do token não é retornado.
- **AC5:** Dado pasta inválida ou sem permissão de escrita, quando o usuário salva, então o sistema retorna erro 400 com mensagem clara.
- **AC6:** Dado que o usuário abre Settings, quando a seção “Resumo de projetos” carrega, então o prompt atual (customizado ou padrão) é exibido com indicador “Padrão” ou “Personalizado”.
- **AC7:** Dado prompt customizado válido, quando o usuário salva, então `ai_project_summary_prompt` é persistido em `config.json` e usado na geração de resumos.
- **AC8:** Dado “Restaurar padrão” seguido de salvar, quando a operação conclui, então `ai_project_summary_prompt` fica vazio no config e o sistema volta a usar o prompt embutido.

## 7. Decisões e alternativas consideradas

| Decisão | Alternativas descartadas | Motivo |
|---------|--------------------------|--------|
| Persistência em `config.json` | Tabela no Postgres | Config de ambiente, fácil de montar no Docker |
| API Routes do Next.js (`/api/*`) | Backend FastAPI separado | App fullstack na raiz do repositório |
| Token só no servidor | Token no localStorage | Segurança |
| Um provedor ativo por vez | Múltiplos perfis | Escopo inicial menor |
| Prompt padrão em código | Só em `config.json` | Funciona out-of-the-box; override opcional |
| System prompt configurável | Prompt + template de user message | Escopo menor; contexto do projeto continua fixo no backend |
| String vazia = padrão | Remover chave do JSON | PUT simples; “restaurar padrão” sem lógica extra |

## 8. Riscos e questões em aberto

- Catálogo de provedores/modelos: lista fixa ou dinâmica?
- Auth em produção para endpoints de settings.
- Aviso ao mudar `projects_folder` com projetos já na pasta anterior.
- Prompt customizado pode degradar qualidade dos resumos sem validação semântica.

**`config.json` (alvo):**

```json
{
  "projects_folder": "/data/projects",
  "agents_folder": "/data/agents",
  "ai_provider": "openai",
  "ai_model": "gpt-4o-mini",
  "ai_api_token": "sk-...",
  "ai_project_summary_prompt": ""
}
```

`ai_project_summary_prompt` vazio ou ausente → usa o default em
`app/lib/server/project-ai-summary-prompt.ts`.

**API:**

- `GET /api/settings` →
  `{ projects_folder, agents_folder, config_path, ai_provider, ai_model, has_ai_token, ai_project_summary_prompt, default_ai_project_summary_prompt, uses_custom_ai_project_summary_prompt }`
- `PUT /api/settings` →
  `{ projects_folder?, agents_folder?, ai_provider?, ai_model?, ai_api_token?, ai_project_summary_prompt? }`

**Prompt padrão (resumo):**

```
Você resume o estado atual de um projeto de software para um card de dashboard.
Use apenas os dados fornecidos. Não invente PRs, demandas ou datas.
Responda em português do Brasil, em tom direto e útil.
Máximo de 2 frases curtas (até ~200 caracteres no total).
Foque no que importa agora: pendências, specs, critérios de aceite e contexto do repositório.
Responda APENAS com o texto do resumo, sem JSON, markdown ou aspas extras.
```
