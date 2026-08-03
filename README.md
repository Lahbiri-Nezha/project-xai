# Sales Insight

Plateforme de sales intelligence pour le marché Maroc / MENA — prospection B2B, scoring IA expliqué, enrichment multi-source, sequences d'engagement et conformité RGPD / loi 09-08.

[![CI](https://github.com/Lahbiri-Nezha/sales-insight/actions/workflows/ci.yml/badge.svg)](https://github.com/Lahbiri-Nezha/sales-insight/actions/workflows/ci.yml)

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **tRPC v11** + **zod** (API typée de bout en bout, multi-tenant par `ctx.orgId`)
- **Prisma 7** (PostgreSQL, adapter `pg`)
- **better-auth** (auth multi-tenant : Organization + membres, rôles OWNER/ADMIN/MEMBER/VIEWER)
- **Inngest** (pipeline asynchrone : enrichment, scoring, détection de signaux, purge)
- **Upstash Redis + Ratelimit** (rate-limit par plan)
- **Tailwind CSS v4** + shadcn/ui + framer-motion
- **AI SDK** (`ai` / `@ai-sdk/openai`) — moteurs avec **fallback déterministe local** (le build et l'app fonctionnent sans clé OpenAI)

## Démarrage rapide

```bash
npm install
cp .env.example .env      # renseigner DATABASE_URL au minimum
npx prisma migrate deploy # ou migrate dev
npx prisma db seed        # données de démo Maroc (idempotent)
npm run dev               # http://localhost:3000
```

Le seed (`prisma/seed.ts`) crée un espace de démo **Beta Test** (PRO) avec 24 entreprises marocaines (Casablanca, Rabat, Tanger…), 33 contacts scorés via le vrai moteur, signaux d'achat, flags compliance (OPT_OUT / DO_NOT_CALL), une recherche sauvegardée, deux listes et une séquence de 4 étapes avec 3 inscriptions. Compte démo : `hicham@betatest.ma`. Ré-exécutable sans doublons (upsert + gardes).

Scripts utiles :

```bash
npm run dev        # serveur de dev
npm run build      # build de production + typecheck
npm run lint       # eslint
npm run test       # tests vitest (unitaires : compliance, filtres multi-tenant)
```

## Architecture

Domaine blueprint → module repo :

| Domaine | Router tRPC | Lib / fonctions |
|---|---|---|
| Identity & Access | `organization` | `src/lib/auth-utils.ts`, `auth.ts` |
| Companies | `company` | `src/lib/trpc/routers/company.ts` |
| Contacts | `lead` | `src/lib/trpc/routers/lead.ts`, `src/lib/lead-filter.ts` |
| Enrichment | — (événements Inngest) | `src/lib/ai/enrichment.ts`, `enrich-company.ts`, `scheduled-sync.ts` |
| Buying Signal | — | `src/lib/inngest/functions/detect-signals.ts` |
| Lists & Saved Searches | `list`, `savedSearch` | `saved-search-check.ts` (cron) |
| Sequences | `sequence` | `src/lib/trpc/routers/sequence.ts` |
| Scoring | `lead.rescore` | `src/lib/ai/scoring.ts` (déterministe) |
| Compliance | `compliance` | `src/lib/compliance.ts`, `retention-purge.ts` |
| AI Copilot | `copilot` + route `/api/copilot/stream` | `src/lib/ai/copilot.ts` |

Principes :

- **Pipeline asynchrone uniquement** : jamais de scraping/LLM dans une requête utilisateur — tout passe par Inngest (`src/lib/inngest/functions/`).
- **Multi-tenant par construction** : chaque procédure reçoit `ctx.orgId` et filtre avec `organizationId` ; le gate est testé dans `tests/lead-filter.test.ts`.
- **Compliance intégrée, pas en annexe** : `sequence.enroll` et les exports (`lead.exportCsv`, `list.exportCsv`) excluent les contacts `OPT_OUT` / `DO_NOT_CALL` / `SUPPRESSED` ; les accès et exports sont tracés dans `AccessLog`.

## Variables d'environnement

| Variable | Requise | Rôle |
|---|---|---|
| `DATABASE_URL` | Oui | Postgres (Prisma) |
| `BETTER_AUTH_SECRET` | Oui | Sessions better-auth |
| `BETTER_AUTH_URL` | Prod | Base URL auth (callback/redirect) |
| `OPENAI_API_KEY` | Non | LLM ; sans clé, moteurs déterministes locaux |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Non | Rate-limit (désactivé si absent) |
| `STRIPE_SECRET_KEY`, `STRIPE_*_PRICE_ID` | Non | Billing (webhook `/api/stripe/webhook`) |
| `RETENTION_MONTHS` | Non | Durée de rétention réglementaire (déf. 36) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Non | Exporteur OpenTelemetry (observabilité Inngest) |
| `S3_ENABLED` + `S3_*` | Non | Export CSV vers S3/MinIO (voir ci-dessous) |

## Rate limiting par plan

Trois paliers Upstash, appliqués par plan (`FREE` / `STARTER` / `PRO` / `ENTERPRISE`) :

- **Général** (lectures/écritures) : `protectedProcedure` — 100 / 300 / 900 / 3000 req·h.
- **Coûteux** (LLM : scoring) : `expensiveProcedure` (`lead.rescore`) — 10 / 40 / 120 / 400 req·h.
- **Copilot** : route `/api/copilot/stream` — 10 / 30 / 100 / 300 req·h.

Config dans `src/lib/rate-limit.ts`, application dans `src/lib/trpc/server.ts` et `src/app/api/copilot/stream/route.ts`.

## Observabilité Inngest

Chaque fonction Inngest émet une métrique structurée `[inngest-metrics]` (fn, statut, `durationMs`) via `src/lib/inngest/observability.ts` — de quoi calculer taux d'échec d'enrichissement et latence dans n'importe quel collecteur de logs.

En production, activer les **traces OpenTelemetry** : définir `OTEL_EXPORTER_OTLP_ENDPOINT` (et optionnellement `OTEL_SERVICE_NAME`). À l'initiation de `/api/inngest`, `src/lib/otel.ts` démarre un SDK Node (`@opentelemetry/sdk-node` + `@opentelemetry/exporter-trace-otlp-http`) et chaque run de fonction émet un span `inngest.<fn>` (statut, `durationMs`, attributs métier) exporté en OTLP HTTP vers l'APM de votre choix (Collector, Honeycomb, Datadog…). Sans endpoint, le tracing est un no-op et ne change rien au comportement.

En développement (`INNGEST_DEV=1`), les fonctions ne s'exécutent que si le **dev server Inngest** tourne : `npx inngest-cli dev -u http://localhost:3000/api/inngest`. Sans lui, `inngest.send` échoue et le fallback synchrone prend le relais (le flux utilisateur reste fonctionnel, mais ni fonction ni span ne tournent).

## Tests

```bash
npm test
```

Couverture actuelle (unitaires, sans DB) :

- `tests/compliance.test.ts` — normalisation email/téléphone, gate opt-out/do-not-call/suppression, isolement multi-tenant du gate.
- `tests/lead-filter.test.ts` — `buildLeadWhere` impose toujours `organizationId` et traduit correctement les filtres.

## API keys & exports

- Export CSV : `company.exportCsv`, `lead.exportCsv` (hors opt-out), `list.exportCsv` — sitemap `/sitemap.xml`, robots `/robots.txt`.

### Export CSV vers S3/MinIO (optionnel)

Par défaut, les exports CSV sont générés côté serveur et téléchargés via stream Blob côté client (`src/lib/download.ts`). Pour décharger les gros exports vers un stockage objet :

1. Configurer `S3_ENABLED=true`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (et `S3_FORCE_PATH_STYLE=true` pour MinIO) — voir `.env.example`.
2. Les endpoints `list.exportCsv` / `lead.exportCsv` / `company.exportCsv` uploadent alors le fichier via `src/lib/export-storage.ts` (`@aws-sdk/client-s3`) et renvoient une URL (`exports/YYYY-MM-DD/<fichier>.csv`).
3. Le client télécharge l'URL S3 ; si l'upload échoue ou si S3 n'est pas configuré, il retombe automatiquement sur le stream Blob local. Aucune clé ne change de comportement existant.

MinIO local : `docker run -p 9000:9000 -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin minio/minio server /data` puis créer le bucket via la console.
