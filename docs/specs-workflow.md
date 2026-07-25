# Wiki do `.specs`

O `.specs` é um formato versionado para manter requisitos, critérios de aceite e progresso de entrega próximos ao código. Ele permite que pessoas e agentes de IA compartilhem a mesma fonte de contexto sem misturar a descrição do produto com o estado da implementação.

## Visão geral

O fluxo separa duas responsabilidades:

| Responsabilidade | Fonte da verdade |
|---|---|
| Contexto, escopo, requisitos e critérios de aceite | `.specs/features/*.md` |
| Status, dependências, issues e pull requests | `.specs/spec-checklist.json` |

Os arquivos Markdown explicam **o que deve ser construído**. O checklist JSON registra **em que ponto a entrega está**.

## Estrutura da pasta

```text
.specs/
├── README.md
├── bootstrap-ai-rules.md
├── spec-template.md
├── spec-checklist.json
├── spec-checklist.schema.json
├── features/
│   ├── 001-modulo_subfeature.md
│   └── 002-modulo.md
└── templates/
    ├── cursor/
    │   ├── commands/
    │   └── skills/
    └── claude/
        └── skills/
```

### `README.md`

É a referência operacional para pessoas e agentes. Descreve convenções de nomes, campos do checklist, dependências e o ciclo de trabalho.

### `features/`

Contém uma especificação por feature ou subfeature. Cada arquivo usa um ID de três dígitos e critérios de aceite estáveis:

```text
001-projects_ai-input.md
002-settings.md
003-projects.md
```

Convenções:

- Feature: `{id}-{modulo}.md`
- Subfeature: `{id}-{modulo}_{featureslug}.md`
- O prefixo do arquivo deve ser igual ao `specId` do checklist.
- Critérios de aceite usam IDs como `AC1`, `AC2` e `AC3`.
- Status, checkboxes, issues e PRs não são escritos nesses arquivos.

### `spec-template.md`

Modelo usado para criar specs. Ele padroniza:

1. contexto e problema;
2. objetivo;
3. escopo e fora de escopo;
4. requisitos funcionais e não funcionais;
5. fluxo esperado;
6. critérios de aceite;
7. decisões e alternativas;
8. riscos e questões em aberto.

Se uma seção não se aplicar, use `N/A` em vez de removê-la.

### `spec-checklist.json`

Mantém o estado de entrega. A estrutura suporta um projeto simples ou vários projetos de um monorepo:

```json
{
  "$schema": "./spec-checklist.schema.json",
  "version": 1,
  "updatedAt": "2026-07-25",
  "projects": [
    {
      "id": "web",
      "name": "Aplicação Web",
      "specs": [
        {
          "specId": "001",
          "specFile": "features/001-auth.md",
          "title": "Autenticação",
          "checklist": [
            {
              "ac": "AC1",
              "description": "Login com credenciais válidas",
              "status": "done",
              "completedCommit": "28b29985168398322c078dbe6093b6f0b083247c",
              "issues": [],
              "prs": []
            }
          ]
        }
      ]
    }
  ]
}
```

Status permitidos:

- `todo`: ainda não iniciado;
- `in-progress`: trabalho em andamento;
- `blocked`: impedimento externo;
- `done`: critério verificado.

O campo `updatedAt` deve ser atualizado sempre que o checklist mudar.

Em novas conclusões, `completedCommit` recebe o hash completo do commit que tornou o critério atendido e aparece somente em itens `done`. A data/hora de conclusão é herdada dos metadados desse commit, sem duplicação no checklist. Conclusões históricas podem continuar sem o campo quando não houver evidência confiável.

Na leitura, o Dev Workspace usa o Git CLI para resolver commits de projetos locais. Em projetos GitHub, usa a API de commits autenticada com o PAT cadastrado no projeto. A resposta da API expõe a data/hora derivada como `completedAt`; esse campo não é gravado no `spec-checklist.json`.

Como um commit não pode armazenar o próprio hash, o fluxo usa dois passos: primeiro é criado o commit da implementação; depois o checklist é atualizado apontando para esse commit. Ao reabrir um AC, remova o campo.

### `spec-checklist.schema.json`

Define o JSON Schema do checklist. Cursor, VS Code e outros editores compatíveis podem validar automaticamente IDs, status e tipos de campo por meio da propriedade `$schema`.

### `bootstrap-ai-rules.md`

É o playbook de instalação do fluxo em outro projeto. Ele orienta a IA a:

- instalar commands e skills;
- criar ou mesclar regras do Cursor;
- integrar instruções em `CLAUDE.md` e `AGENTS.md`;
- adaptar o checklist ao novo repositório;
- preservar configurações já existentes.

### `templates/`

Distribui integrações reutilizáveis para ferramentas de IA:

- Cursor commands: `/bootstrap-specs`, `/update-specs` e `/new-spec`;
- Cursor skill: gerenciamento do checklist;
- Claude Code skills equivalentes.

Os templates são a fonte de instalação. Depois do bootstrap, as cópias ativas ficam nas pastas `.cursor/` e `.claude/` do projeto consumidor.

## Ciclo de uso

### 1. Antes de implementar

1. Localize a spec correspondente em `.specs/features/`.
2. Leia seus requisitos e critérios de aceite.
3. Consulte o item no `spec-checklist.json`.
4. Confirme se dependências `before` e `after` estão atendidas.
5. Se a feature ainda não tiver spec, crie uma a partir do template e registre seus ACs no checklist.

### 2. Durante a implementação

1. Marque o AC trabalhado como `in-progress`.
2. Preserve os IDs de spec e AC.
3. Atualize a spec e o checklist se o escopo mudar.
4. Adicione números de issues e PRs quando existirem.

### 3. Ao concluir

1. Verifique o comportamento descrito no critério.
2. Confirme que a implementação atendida já existe em um commit.
3. Marque o AC como `done` e registre o hash completo em `completedCommit`; a data/hora de conclusão será a do commit. Use `blocked` somente para impedimentos externos.
4. Atualize `updatedAt`.
5. Confirme que `specId`, `specFile` e IDs `ACn` continuam alinhados.

## Dependências

`after` declara pré-requisitos; `before` informa quais itens dependem do atual. A dependência pode existir entre specs, entre ACs da mesma spec ou entre ACs de specs diferentes.

```json
{
  "ac": "AC2",
  "after": [
    "AC1",
    { "specId": "002", "ac": "AC3" }
  ]
}
```

Nesse exemplo, `AC2` só pode avançar depois de `AC1` da mesma spec e de `AC3` da spec `002`.

Declare a relação em apenas um dos lados. Não é necessário espelhar `after` e `before`.

## Como adotar em outro projeto

### Opção recomendada: copiar e executar o bootstrap

1. Copie `.specs/` para a raiz do repositório de destino.
2. Remova specs de exemplo que não pertencem ao projeto.
3. Peça ao agente:

```text
Execute o bootstrap completo de .specs/ conforme
.specs/bootstrap-ai-rules.md. Instale commands, skills, rules,
CLAUDE.md e AGENTS.md, e ajuste spec-checklist.json.
Não altere código de produto e não faça commit.
```

4. Revise `projects[].id` e `projects[].name` no checklist.
5. Execute `/update-specs` para reconciliar as specs com o código existente.
6. Versione `.specs/` e as integrações instaladas.

O bootstrap faz merge quando encontra instruções customizadas. Ele não deve sobrescrever `CLAUDE.md`, `AGENTS.md` ou regras existentes sem preservar o conteúdo do projeto.

### Opção manual

Para usar somente o formato, sem instalar automações:

1. Copie `spec-template.md`, `spec-checklist.schema.json` e este modelo de estrutura.
2. Crie `.specs/features/`.
3. Crie o `spec-checklist.json` com o `$schema`.
4. Documente em `AGENTS.md` ou equivalente que agentes devem ler e atualizar esses arquivos.
5. Valide o checklist no editor ou em CI.

### Monorepos

Use um item em `projects` para cada aplicação ou pacote:

```json
{
  "projects": [
    { "id": "api", "name": "Backend API", "specs": [] },
    { "id": "web", "name": "Frontend", "specs": [] }
  ]
}
```

As specs podem ser organizadas em subpastas, mantendo `specFile` relativo a `.specs/`:

```text
.specs/features/api/010-auth.md
.specs/features/web/011-login.md
```

## Comandos disponíveis

| Comando | Uso |
|---|---|
| `/bootstrap-specs` | Instala regras, commands, skills e instruções de agentes |
| `/new-spec` | Cria uma spec pelo template e registra seus ACs |
| `/update-specs` | Reconcilia código, specs e checklist |
| `/spec-checklist` | Inicia, conclui, bloqueia ou lista ACs |

Exemplos de linguagem natural:

```text
Crie uma spec para autenticação por passkey.
Inicie AC2 da spec 003.
Bloqueie AC4 da spec 001 por dependência externa.
Liste as pendências da spec settings.
```

## Boas práticas

- Trate IDs de specs e ACs como identificadores permanentes.
- Escreva ACs observáveis e verificáveis.
- Evite duplicar regras de negócio no checklist.
- Não marque `done` antes de verificar o critério.
- Não invente datas ou commits para conclusões históricas.
- Mantenha a spec atualizada quando o comportamento mudar.
- Use issues e PRs como rastreabilidade, não como substitutos da spec.
- Não versione `.obsidian/` quando ela contiver apenas configuração local.

## Referências no repositório

- [Documentação operacional](../.specs/README.md)
- [Template de spec](../.specs/spec-template.md)
- [Playbook de bootstrap](../.specs/bootstrap-ai-rules.md)
- [Checklist atual](../.specs/spec-checklist.json)
- [Schema do checklist](../.specs/spec-checklist.schema.json)
