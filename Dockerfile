# Syntaxe: docker/dockerfile:1
# Dockerfile multi-stage pour Sales Insight (Next.js 16, sortie standalone).

# ---------------------------------------------------------------------------
# 1) Dependances (node_modules complet, y compris dev pour le build)
# ---------------------------------------------------------------------------
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# 2) Build de production (sortie standalone)
#    DATABASE_URL est requis a la collecte des page data (construction du
#    client Prisma) ; une valeur factice suffit, aucune connexion n'est faite.
# ---------------------------------------------------------------------------
FROM node:22-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG DATABASE_URL=postgresql://postgres:postgres@db:5432/sales_insight
ENV DATABASE_URL=$DATABASE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# 3) Image runtime (production)
# ---------------------------------------------------------------------------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Sortie standalone (code serveur trace) + statiques + public.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Migrations Prisma (schema + SQL) pour les jobs de migration au deploiement.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.status>=200&&r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
