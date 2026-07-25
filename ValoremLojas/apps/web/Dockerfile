# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/package.json

RUN npm install

COPY apps/web/ ./apps/web/

# O Next inlina NEXT_PUBLIC_* no bundle durante o build — definir isso como
# variável de runtime no compose não tem efeito nenhum no código do cliente.
# Por isso entra como ARG: a URL da API fica assada na imagem, e cada ambiente
# (local, loja.mjml.com.br) precisa da sua própria build.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_DEV_STORE=demo
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_DEV_STORE=$NEXT_PUBLIC_DEV_STORE

RUN npm run build --workspace=apps/web

# ─── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/package.json

RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/apps/web/.next    ./apps/web/.next
COPY apps/web/next.config.mjs              ./apps/web/next.config.mjs

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=apps/web"]
