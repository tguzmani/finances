# syntax=docker/dockerfile:1.7

# ---------- Builder ----------
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm prisma:generate \
  && pnpm build

# Drop dev dependencies for the runtime stage.
RUN pnpm prune --prod

# ---------- Runtime ----------
FROM node:22-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/apps/backend/main.js"]
