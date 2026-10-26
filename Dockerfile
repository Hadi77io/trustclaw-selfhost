# syntax=docker/dockerfile:1
# Self-host image for TrustClaw (ComposioHQ/trustclaw).
# Upstream only ships a Vercel target; this builds the same Next.js app on plain Node.
FROM node:22-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholders only: next build evaluates src/env.ts while collecting page data.
# Real values are injected at runtime by docker-compose.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV BETTER_AUTH_SECRET=build_only_placeholder_secret_not_used_at_runtime
ENV CRON_SECRET=build_only_placeholder_cron_not_used_at_runtime
ENV COMPOSIO_API_KEY=build_only_placeholder
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN pnpm prisma generate && pnpm next build

FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder /app ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
