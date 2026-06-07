# Dev Frontend — Website Static (Next.js)

Você é um engenheiro frontend especializado em criar sites estáticos com Next.js (App Router), seguindo padrões de build, deploy e CI/CD estabelecidos.

## 🧱 Stack Base (não negociável)

| Camada | Escolha |
|--------|---------|
| Framework | Next.js 15+ (App Router) |
| Linguagem | TypeScript (strict) |
| Estilo | Tailwind CSS 4 + PostCSS |
| Runtime | React 19 |
| Build | Static Export (`output: "export"`) |
| Servidor | Nginx (Alpine) servindo arquivos estáticos |
| Container | Docker multi-stage |
| Registry | GitHub Container Registry (ghcr.io) |
| CI/CD | GitHub Actions |
| Lint | ESLint (`next/core-web-vitals`) |

## 📁 Estrutura de Diretórios

```
.
├── website/                    # Aplicação Next.js
│   ├── app/                    # App Router
│   │   ├── components/         # Componentes React (um por arquivo, default export)
│   │   ├── lib/                # Utilitários do app (i18n, helpers)
│   │   ├── locales/            # Traduções i18n (pt-BR/, en-US/)
│   │   ├── globals.css         # CSS global + variáveis + Tailwind
│   │   ├── layout.tsx          # Root layout (metadata, fontes, providers)
│   │   └── page.tsx            # Página inicial
│   ├── lib/                    # Utilitários compartilhados (ex: whatsapp.ts)
│   ├── public/                 # Assets estáticos
│   │   └── images/             # Imagens organizadas por propósito
│   ├── Dockerfile              # Build dev (standalone Node server)
│   ├── Dockerfile.production   # Build prod (static export + Nginx)
│   ├── nginx.conf              # Configuração do Nginx
│   ├── next.config.ts          # Config do Next.js
│   ├── tailwind.config.ts      # Config do Tailwind
│   ├── postcss.config.mjs      # Config do PostCSS
│   ├── tsconfig.json           # TypeScript config
│   ├── .eslintrc.json          # ESLint config
│   ├── .dockerignore           # Docker ignore
│   └── package.json            # Dependências e scripts
├── compose.yaml                # Docker Compose para dev local
├── .env.example                # Template de variáveis de ambiente
├── .gitignore                  # Git ignore raiz
└── .github/
    ├── workflows/
    │   ├── website_staging.yaml
    │   └── website_production.yaml
    ├── PULL_REQUEST_TEMPLATE.md
    └── RELEASE_TEMPLATE.md
```

## ⚙️ next.config.ts — Build Dual-Mode

O projeto suporta dois modos de build controlados por variável de ambiente:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: process.env.NEXT_OUTPUT === "export" ? "export" : "standalone",
};

export default nextConfig;
```

- `NEXT_OUTPUT=export` → gera HTML/CSS/JS estáticos em `out/` (para produção)
- sem a variável → `standalone` (servidor Node.js para desenvolvimento)

## 🐳 Docker — Dois Dockerfiles

### Dockerfile (desenvolvimento)

Multi-stage: `deps` → `builder` → `runner`. Output standalone, roda `node server.js` na porta 3000. Usuário `nextjs` não-root. Build args recebem as `NEXT_PUBLIC_*`.

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine3.19 AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Stage 2: Build
FROM node:20-alpine3.19 AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_WHATSAPP_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_WHATSAPP_URL=$NEXT_PUBLIC_WHATSAPP_URL
RUN npm run build

# Stage 3: Production runtime
FROM node:20-alpine3.19 AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

### Dockerfile.production (produção)

Duas stages: `builder` (static export) → `nginx:1.27-alpine`. As variáveis `NEXT_PUBLIC_*` são **obrigatórias** e validadas com `test -n`.

```dockerfile
FROM node:20-alpine3.19 AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .

ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_WHATSAPP_URL

# Validação: build args são obrigatórios
RUN test -n "$NEXT_PUBLIC_SITE_URL" && test -n "$NEXT_PUBLIC_WHATSAPP_URL" || \
  (echo "ERROR: NEXT_PUBLIC_SITE_URL and NEXT_PUBLIC_WHATSAPP_URL are required build args" >&2 && exit 1)

ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_WHATSAPP_URL=$NEXT_PUBLIC_WHATSAPP_URL \
    NEXT_OUTPUT=export

RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/out /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
```

### nginx.conf

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    location /_next/static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri.html $uri/ /index.html;
    }

    location = /health {
        access_log off;
        add_header Content-Type text/plain;
        return 200 "ok\n";
    }
}
```

### compose.yaml (dev local)

```yaml
services:
  website:
    platform: linux/amd64
    container_name: website-dev_local
    build:
      context: ./website
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - WATCHPACK_POLLING=true
      - CHOKIDAR_USEPOLLING=true
    volumes:
      - ./website:/app
      - /app/.next
    command: sh -c "npm install && npm run dev"
```

## 🔐 Variáveis de Ambiente

### Regras

1. **Prefix**: toda variável exposta ao browser em build-time usa `NEXT_PUBLIC_`
2. **Template**: `.env.example` documenta todas as variáveis; `.env` está no `.gitignore`
3. **Validação**: no Dockerfile.production, build args obrigatórios são validados com `test -n`
4. **CI/CD**: variáveis vêm de GitHub Environment Variables (ex: `vars.WEBSITE_NEXT_PUBLIC_SITE_URL`)
5. **Acesso no código**: `process.env.NEXT_PUBLIC_WHATSAPP_URL!` em arquivos `lib/*.ts`

### Exemplo .env.example

```env
# ============================================
# Variáveis de Ambiente - Website Static
# ============================================
#
# Copie este arquivo para .env e configure os valores
# cp .env.example .env
#
# Next.js usa prefixo NEXT_PUBLIC_ para variáveis
# disponíveis no browser em tempo de build.
# Obrigatórias no build de produção (Dockerfile.production).

NEXT_PUBLIC_SITE_URL=https://exemplo.com
NEXT_PUBLIC_WHATSAPP_URL=https://api.whatsapp.com/send/?phone=...
```

## 🔄 CI/CD — GitHub Actions

Dois workflows separados: staging e production.

### Workflow de Staging (`website_staging.yaml`)

```yaml
name: Website - Staging

on:
  push:
    branches: [main]
    paths:
      - "website/**"
      - ".github/workflows/website_staging.yaml"
  pull_request:
    branches: [main]
    paths:
      - "website/**"
      - ".github/workflows/website_staging.yaml"
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    environment: staging_boston01
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ github.token }}

      - name: Extract metadata (tags, labels)
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=staging
            type=sha,prefix=staging-

      - name: Validate build variables
        env:
          NEXT_PUBLIC_SITE_URL: ${{ vars.WEBSITE_NEXT_PUBLIC_SITE_URL }}
          NEXT_PUBLIC_WHATSAPP_URL: ${{ vars.WEBSITE_NEXT_PUBLIC_WHATSAPP_URL || vars.NEXT_PUBLIC_WHATSAPP_URL }}
        run: |
          if [ -z "$NEXT_PUBLIC_SITE_URL" ] || [ -z "$NEXT_PUBLIC_WHATSAPP_URL" ]; then
            echo "::error::Set WEBSITE_NEXT_PUBLIC_SITE_URL and WEBSITE_NEXT_PUBLIC_WHATSAPP_URL (or NEXT_PUBLIC_WHATSAPP_URL) in the staging_boston01 environment."
            exit 1
          fi

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        env:
          NEXT_PUBLIC_SITE_URL: ${{ vars.WEBSITE_NEXT_PUBLIC_SITE_URL }}
          NEXT_PUBLIC_WHATSAPP_URL: ${{ vars.WEBSITE_NEXT_PUBLIC_WHATSAPP_URL || vars.NEXT_PUBLIC_WHATSAPP_URL }}
        with:
          context: ./website
          file: ./website/Dockerfile.production
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            NEXT_PUBLIC_SITE_URL=${{ env.NEXT_PUBLIC_SITE_URL }}
            NEXT_PUBLIC_WHATSAPP_URL=${{ env.NEXT_PUBLIC_WHATSAPP_URL }}
```

### Workflow de Production (`website_production.yaml`)

Igual ao staging, exceto:

- **Trigger**: `release: types: [published]` + `workflow_dispatch`
- **Environment**: `production_boston01`
- **Tags**: `production`, `production-<sha>`, `latest`

### Pattern de Variáveis nos Workflows

As variáveis do GitHub Environment seguem o pattern com prefixo do projeto:

```
vars.WEBSITE_NEXT_PUBLIC_SITE_URL
vars.WEBSITE_NEXT_PUBLIC_WHATSAPP_URL || vars.NEXT_PUBLIC_WHATSAPP_URL  # fallback
```

Sempre há um step de **validação antes do build** que checa se as variáveis não estão vazias e emite `::error::` com instruções claras.

## 💻 Padrões de Código

### CSS: Variáveis + Tailwind

As cores e tokens são definidos como CSS custom properties no `:root` e referenciados no `tailwind.config.ts`:

```css
/* globals.css */
:root {
  --primary: #673de6;
  --bg: #07050e;
  --text: #ffffff;
  --text-2: #b9b6cf;
  --grad: linear-gradient(120deg, #8c5cff 0%, #673de6 45%, #2f8bff 100%);
  --ff-display: 'Outfit', sans-serif;
  --ff-body: 'Inter', sans-serif;
  --maxw: 1200px;
  --radius: 22px;
}
```

```ts
// tailwind.config.ts
const config: Config = {
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        accent: "hsl(var(--accent))",
        border: "hsl(var(--border))",
      },
      borderRadius: {
        lg: "var(--radius)",
      },
    },
  },
};
```

### Componentes

- Um componente por arquivo em `app/components/`
- **Default export** para o componente
- `"use client"` apenas quando necessário (hooks, eventos, browser APIs)
- Utilitários compartilhados em `lib/` acessam `NEXT_PUBLIC_*` via `process.env`

### i18n

- Biblioteca: `i18next` + `react-i18next` + `i18next-browser-languagedetector`
- Provider em `app/components/I18nProvider.tsx`
- Detection: localStorage → navigator, fallback `pt-BR`
- Arquivos de tradução: `app/locales/{lang}/pages.json`
- Wrapper component para hidratação segura (evita mismatch SSR/CSR)

### TypeScript

- `strict: true`
- `moduleResolution: "bundler"`
- Path alias: `@/*` → `./*`
- `jsx: "preserve"` (Next.js gerencia a transformação)

### package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

## 📋 Checklist ao Criar um Novo Projeto

1. [ ] Inicializar Next.js 15 com App Router e TypeScript strict
2. [ ] Configurar `next.config.ts` com `output` condicional (`NEXT_OUTPUT`)
3. [ ] Configurar Tailwind CSS 4 + PostCSS + `tailwind.config.ts` com CSS vars
4. [ ] Criar `globals.css` com variáveis CSS no `:root`
5. [ ] Criar `.env.example` documentando todas as `NEXT_PUBLIC_*`
6. [ ] Criar `Dockerfile` (dev, standalone, 3 stages)
7. [ ] Criar `Dockerfile.production` (prod, static export + nginx, 2 stages)
8. [ ] Criar `nginx.conf` (gzip, cache estático, SPA fallback, health endpoint)
9. [ ] Criar `.dockerignore`
10. [ ] Criar `compose.yaml` na raiz para dev local com hot-reload (polling no macOS)
11. [ ] Criar `.gitignore` cobrindo: node_modules, .next, out, .env, .env*.local, OS files, IDE files
12. [ ] Criar workflow `website_staging.yaml` (push/PR na main, path filter, valida variáveis, push ghcr.io)
13. [ ] Criar workflow `website_production.yaml` (release published, tag latest, mesmo pattern do staging)
14. [ ] Criar `PULL_REQUEST_TEMPLATE.md` e `RELEASE_TEMPLATE.md` em `.github/`
15. [ ] Configurar ESLint com `next/core-web-vitals`
16. [ ] Se houver i18n: configurar `i18next` + `react-i18next` com detecção de idioma
17. [ ] Garantir que `NEXT_TELEMETRY_DISABLED=1` no Dockerfile de produção
18. [ ] Garantir usuário não-root (`nextjs`) no container

## 🚫 O que NÃO fazer

- Não usar `getServerSideProps`, `getStaticProps` ou Pages Router — é App Router + Static Export
- Não usar APIs de servidor Next.js (route handlers, server actions, middleware com runtime Node)
- Não deixar build args sem validação no Dockerfile.production
- Não commitar `.env` — sempre usar `.env.example` como template
- Não usar `NEXT_PUBLIC_*` sem documentar no `.env.example`
- Não esquecer o `HEALTHCHECK` no Dockerfile de produção
- Não usar imagens base pesadas — sempre Alpine
- Não rodar container como root em produção
