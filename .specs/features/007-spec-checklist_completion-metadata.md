# 007 Specs · Metadados de conclusão do checklist

> **Última atualização:** 2026-07-25

---

## 1. Contexto e problema

Itens concluídos no `spec-checklist.json` registram apenas o status `done`. Sem referência ao commit da implementação, não é possível saber quando o critério foi atendido nem localizar diretamente o código que o concluiu.

## 2. Objetivo

Permitir que cada AC concluído registre o commit que tornou o critério atendido e herde dele sua data/hora de conclusão.

## 3. Escopo

### Dentro do escopo
- Adicionar metadados de conclusão ao schema dos itens do checklist.
- Preservar o commit e resolver a data/hora na leitura feita pela API do workspace.
- Atualizar as automações e a documentação do fluxo de conclusão e reabertura.
- Manter compatibilidade com ACs históricos concluídos sem metadados.

### Fora do escopo
- Inferir ou inventar metadados para ACs históricos.
- Criar commits automaticamente.
- Exibir os novos campos no dashboard.

## 4. Requisitos

### Funcionais
- **RF1:** Um AC concluído pode armazenar `completedCommit` com o hash completo do commit que atendeu ao critério.
- **RF2:** Para projetos locais, a data/hora de conclusão deve ser obtida do commit pelo Git CLI no repositório do projeto.
- **RF3:** Para projetos GitHub, a data/hora de conclusão deve ser obtida pela API do GitHub usando o PAT cadastrado no projeto.
- **RF4:** A data/hora não deve ser duplicada no checklist.
- **RF5:** Novas transições para `done` devem preencher `completedCommit`.
- **RF6:** Ao reabrir ou mover um AC concluído para outro status, `completedCommit` deve ser removido.
- **RF7:** A API de checklist deve preservar `completedCommit` e retornar `completedAt` como valor derivado quando o commit for resolvido.

### Não-funcionais
- **RNF1:** Checklists existentes com itens `done` sem os novos campos devem continuar válidos.
- **RNF2:** O schema deve impedir o campo em status não concluídos e rejeitar hashes inválidos.
- **RNF3:** O hash registrado deve ter 40 caracteres para SHA-1 ou 64 para SHA-256, em hexadecimal minúsculo.

## 5. Fluxo / Comportamento esperado

1. A implementação que atende ao AC é verificada e commitada.
2. O AC é marcado como `done` em uma alteração posterior.
3. `completedCommit` recebe o hash completo do commit da implementação; a data/hora de conclusão é a data/hora desse commit.
4. Ao carregar o checklist, o workspace consulta o commit pelo Git CLI no repositório local ou pela API do GitHub com o PAT cadastrado.
5. A API retorna a data/hora resolvida em `completedAt`, sem gravá-la no checklist.
6. Se o AC for reaberto, o campo é removido.
7. ACs históricos sem rastreabilidade permanecem sem o campo até que haja evidência confiável.

## 6. Critérios de aceite

- **AC1:** Dado um item do checklist, quando o metadado de conclusão for adicionado, então o schema aceita `completedCommit` válido somente associado ao status `done`.
- **AC2:** Dado um checklist com `completedCommit`, quando a API o carregar, então preserva o hash e retorna `completedAt` a partir do Git CLI para projeto local ou da API do GitHub autenticada com o PAT para projeto remoto.
- **AC3:** Dado que um agente conclui ou reabre um AC, quando atualiza o checklist, então ele preenche ou remove `completedCommit` conforme a transição.
- **AC4:** Dado um projeto que adota o `.specs`, quando consulta a documentação e os templates, então encontra a semântica dos campos, a compatibilidade histórica e a limitação de autorreferência de commits.

## 7. Decisões e alternativas consideradas

| Decisão | Alternativas descartadas | Motivo |
|---------|--------------------------|--------|
| Data/hora herdada do commit | Campo `completedAt` no checklist | Evita duplicação e divergência entre o timestamp e o commit referenciado. |
| Hash completo em `completedCommit` | Hash curto | Evita ambiguidade e mantém rastreabilidade entre repositórios. |
| Campos opcionais para `done` histórico | Backfill automático | O histórico atual não permite atribuição confiável por AC. |
| Commit da implementação | Commit que altera o checklist | Um commit não pode armazenar o próprio hash sem alterar esse hash. |

## 8. Riscos e questões em aberto

- ACs históricos permanecem sem metadados até uma eventual migração baseada em evidências.
- A conclusão precisa ocorrer depois de existir um commit de implementação.
- Um commit inexistente, inacessível ou sem permissão mantém `completedAt` nulo sem ocultar o checklist.
