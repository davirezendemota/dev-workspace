# 010 Settings · Temas visuais

> **Última atualização:** 2026-07-28

---

## 1. Contexto e problema

A configuração de aparência atual trata claro e escuro como se fossem temas,
embora representem apenas modos de cor. O frontend precisa permitir identidades
visuais distintas, mantendo o visual atual como `classic` e oferecendo uma
alternativa inspirada na interface do GitHub.

## 2. Objetivo

O usuário escolhe, em Settings > Aparência, entre os temas Classic e GitHub e
combina essa escolha com os modos claro e escuro.

## 3. Escopo

### Dentro do escopo
- Tema `classic` como identidade visual padrão e compatível com o frontend atual
- Tema `github` com tipografia, cores, bordas, raios e componentes inspirados no GitHub
- Seletores “Tema” e “Modo” em Settings > Aparência
- Modos `light` e `dark` disponíveis para ambos os temas
- Persistência de `ui_theme` e `ui_mode` em `config.json`
- Aplicação imediata e restauração sem flash visível ao recarregar
- Migração transparente do formato legado, em que `ui_theme` armazenava `light` ou `dark`

### Fora do escopo
- Reprodução pixel-perfect ou uso de marca/logotipo do GitHub
- Download ou empacotamento de fontes proprietárias
- Temas criados pelo usuário
- Sincronização automática com o tema do sistema operacional

## 4. Requisitos

### Funcionais
- **RF1:** Exibir um seletor “Tema” com `Classic` e `GitHub` em Settings > Aparência.
- **RF2:** Exibir um seletor “Modo” com `Claro` e `Escuro`, substituindo o uso anterior do seletor “Tema” para essa finalidade.
- **RF3:** Persistir a identidade visual em `ui_theme` (`classic` ou `github`) e o modo de cor em `ui_mode` (`light` ou `dark`).
- **RF4:** Aplicar qualquer combinação válida de tema e modo em todo o frontend.
- **RF5:** Tratar configurações legadas `ui_theme: "light" | "dark"` como tema `classic` e migrar seu valor para `ui_mode`.
- **RF6:** Aplicar a preferência salva antes da primeira pintura da página.

### Não-funcionais
- **RNF1:** O tema GitHub deve usar pilha de fontes de sistema semelhante à interface do GitHub, sem depender de fonte remota adicional.
- **RNF2:** Os temas devem reutilizar tokens CSS para manter consistência entre componentes.
- **RNF3:** Estados de foco, contraste e feedback visual devem permanecer perceptíveis nos dois modos.

## 5. Fluxo / Comportamento esperado

1. O usuário abre Settings e acessa a seção “Aparência”.
2. O sistema carrega o tema e o modo atuais.
3. O usuário seleciona `Classic` ou `GitHub` em “Tema” e `Claro` ou `Escuro` em “Modo”.
4. Ao salvar, a API valida e persiste os dois valores.
5. A combinação escolhida é aplicada imediatamente em todo o dashboard.
6. Ao recarregar, a preferência cacheada é aplicada antes da hidratação, sem flash do tema padrão.

### Identidade visual GitHub
- Tipografia sans-serif baseada na pilha de fontes de sistema.
- Modo claro com superfícies brancas/cinza-claro, texto charcoal, bordas neutras e azul como ação principal.
- Modo escuro com superfícies próximas à paleta dark do GitHub, texto cinza-claro, bordas discretas e azul como ação principal.
- Botões, inputs, selects, cards, tags, tabelas, código e estados de foco com raios, preenchimentos e bordas semelhantes aos padrões do GitHub.

## 6. Critérios de aceite

- **AC1:** Dado Settings > Aparência, quando a seção carrega, então são exibidos separadamente “Tema” (`Classic`/`GitHub`) e “Modo” (`Claro`/`Escuro`).
- **AC2:** Dada uma combinação válida de tema e modo, quando o usuário salva, então `ui_theme` e `ui_mode` são persistidos e aplicados imediatamente em todo o frontend.
- **AC3:** Dado o tema `github`, quando o frontend é exibido em modo claro ou escuro, então tipografia, paleta e componentes seguem uma identidade visual semelhante à interface do GitHub sem perder legibilidade ou foco visível.
- **AC4:** Dada uma configuração legada com `ui_theme` igual a `light` ou `dark`, quando ela é carregada, então o sistema preserva o modo anterior, usa `classic` como tema e persiste o novo formato na próxima alteração.
- **AC5:** Dadas preferências já salvas, quando a página é recarregada, então tema e modo são aplicados antes da hidratação sem flash visível do Classic claro.

## 7. Decisões e alternativas consideradas

| Decisão | Alternativas descartadas | Motivo |
|---------|--------------------------|--------|
| Separar `ui_theme` de `ui_mode` | Codificar combinações como `github-dark` | Evita explosão de opções e mantém os conceitos independentes |
| Manter `classic` como padrão | Renomear ou substituir o visual atual | Preserva compatibilidade e preferência dos usuários existentes |
| Usar atributos de dados e tokens CSS | Duplicar componentes por tema | Reduz divergência funcional e custo de manutenção |
| Usar fontes de sistema no GitHub | Importar fonte externa específica | Aparência próxima, carregamento imediato e sem nova dependência |

## 8. Riscos e questões em aberto

- Componentes com cores ou dimensões hardcoded podem exigir ajustes específicos para refletir integralmente o tema GitHub.
- “Parecido com GitHub” é uma direção visual, não uma reprodução pixel-perfect.
