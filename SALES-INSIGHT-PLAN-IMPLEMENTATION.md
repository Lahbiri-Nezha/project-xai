# Sales Insight — Plan d'implémentation

Blueprint produit → exécution technique. Ce plan traduit les 10 domaines et 5 écrans du blueprint en sprints concrets, en tenant compte de ce qui est **déjà construit** dans `sales-insight/`.

> Statut de référence : juillet 2026. Plan couvrant le blueprint complet (V1 → V4).

---

## 1. État des lieux — ce qui existe déjà

| Brique blueprint | État dans le repo | Détails |
|---|---|---|
| Auth multi-tenant | ✅ Construit | `better-auth` (login/signup), `Session`, `Organization` + `OrganizationMembership`, rôles OWNER/ADMIN/MEMBER/VIEWER, `orgId` injecté dans chaque procédure tRPC (`src/lib/trpc/server.ts`) |
| Lead / Company / Signal | ✅ Partiel | `schema.prisma` : `Lead`, `Company`, `Signal`, `Activity`. Routers tRPC `lead.list/getById/create/delete` |
| Scoring IA | ✅ Construit | `src/lib/ai/scoring.ts` → `generateObject` (gpt-4o), stocke `score`, `intent`, `scoreExplainability` |
| Copilot | 🟡 Partiel | `src/lib/ai/copilot.ts` (`streamText` + outils) existe mais **non branché au frontend** ; la page `/dashboard/copilot` répond avec des mock strings |
| Enrichissement | 🟡 Partiel | `src/lib/ai/enrichment.ts` + fonctions Inngest `enrich-company`, `scheduled-sync`, `score-leads` |
| Dashboard | 🟡 Mock | `dashboard/page.tsx` affiche des données codées en dur |
| Billing / plans | 🟡 Ébauche | Stripe webhook + `plan-limits.ts` ; quotas non encore appliqués dans les procédures |
| API keys, rate limiting | ✅ Construit | `ApiKey`, `rate-limit.ts` (Upstash) |

**Écarts majeurs vs blueprint :** Prospector (recherche NL + filtres par blocs), confidence par champ (email/téléphone/poste), `BuyingSignal` au niveau entreprise, Lists & Saved Searches, Sequences, Compliance (opt-out/purge), i18n, Copilot réellement branché, dashboard sur données réelles, recherche NL → filtres structurés.

> **⚠️ Tableau historique** (état du repo à la rédaction du plan). À ce jour, **tous** les éléments marqués 🟡 Partiel / Mock sont livrés : Copilot branché (`/api/copilot/stream`, rate-limité, `copilot.sendMessage` mort supprimé), enrichissement complet (5 sources, traces OTel), dashboard sur données réelles (nom d'org + deltas 30 j), quotas par plan appliqués (3 paliers Upstash), et tous les écarts majeurs ci-dessus sont traités dans les sprints 0→5 + passages de finition (§4 et §8).

---

## 2. Architecture cible — 10 domaines → modules repo

Le blueprint prône une architecture par domaines. Dans un monorepo Next.js, chaque domaine = **un router tRPC + un dossier `src/lib/<domaine>/` + une ou plusieurs entités Prisma** (pas de séparation service Node.js séparé en V1 ; à extraire si le périmètre grandit).

| Domaine blueprint | Router tRPC | Fichiers existants / à créer | Modèles Prisma |
|---|---|---|---|
| 1. Identity & Access | `organization` (existe) | `src/lib/trpc/routers/organization.ts` | Organization, Membership, User |
| 2. Companies | `company` **à créer** | `src/lib/trpc/routers/company.ts` | Company (enrichir) |
| 3. Contacts | `lead` (existe, enrichir) | `src/lib/trpc/routers/lead.ts` | Lead (enrichir) |
| 4. Enrichment | `enrichment` **à créer** | `src/lib/ai/enrichment.ts`, Inngest | Company, Lead, DataSource |
| 5. BuyingSignal | `signal` **à créer** | `src/lib/inngest/functions/detect-signals.ts` | BuyingSignal (nouveau) |
| 6. Lists & SavedSearches | `list` + `savedSearch` **à créer** | `src/lib/trpc/routers/lists.ts`, `saved-search.ts` | SavedSearch, List, ListItem (nouveaux) |
| 7. Sequences & Engagement | `sequence` **à créer** | `src/lib/trpc/routers/sequence.ts` | Sequence, SequenceStep, SequenceEnrollment (nouveaux) |
| 8. Scoring & Qualification | `lead.score` (existe) | `src/lib/ai/scoring.ts` | Lead.score, scoreExplainability |
| 9. Compliance | `compliance` **à créer** | `src/lib/trpc/routers/compliance.ts`, Inngest purge | ComplianceFlag, AccessLog (nouveaux) |
| 10. AI Copilot | `copilot` (existe, brancher) | `src/lib/ai/copilot.ts`, route API stream | CopilotChat, CopilotMessage |

**Principes maintenus :** multi-tenant par `ctx.orgId` injecté (déjà en place) — chaque requête Prisma inclut `organizationId` ; pipeline de collecte **asynchrone uniquement** (Inngest, jamais de scraping dans une requête utilisateur) ; `confidence` et statut de vérification comme citoyens de premier ordre du schéma.

---

## 3. Modèle de données cible (évolution de `sales-insight/prisma/schema.prisma`)

### 3.1 Enrichir les modèles existants

```prisma
enum VerificationStatus { UNVERIFIED PENDING VERIFIED INVALID }

// Lead (Contacts) — ajouter :
//   confidenceEmail   Float?
//   confidencePhone   Float?
//   confidenceTitle   Float?
//   verification      VerificationStatus   @default(UNVERIFIED)
//   lastEnrichedAt    DateTime?
//   source            String?          // traçabilité de la source (RGPD / loi 09-08)

// Company — ajouter :
//   headquartersCity String?
//   headquartersCountry String?
//   revenueEstimate  Float?
//   lastVerifiedAt   DateTime?
//   technoStack      String[]         // déjà techStack ; renommer ou aliasser

// CopilotChat — ajouter un champ toolCalls/feedback :
//   CopilotMessage + rating  Int?     // pouce haut/bas (feedback pipeline IA, étape 5)
```

### 3.2 Nouveaux modèles

```prisma
model BuyingSignal {          // Domaine 5 — signaux d'intention au niveau entreprise
  id         String     @id @default(cuid())
  companyId  String
  company    Company    @relation(fields: [companyId], references: [id], onDelete: Cascade)
  type       SignalType          // HIRING, NEWS, FUNDING, ORG_CHANGE, TECH_MATCH...
  intensity  Int        @default(1)   // score d'intensité 1-5
  source     String?              // annonce job, flux RSS, etc.
  detectedAt DateTime   @default(now())
  @@index([companyId, detectedAt(sort: Desc)])
}

model DataSource {            // Domaine 4 — traçabilité de chaque donnée collectée
  id        String   @id @default(cuid())
  companyId String?
  leadId    String?
  kind      String            // "website", "job_board", "dns", "crunchbase", "csv"...
  url       String?
  payload   Json?
  fetchedAt DateTime @default(now())
}

model ComplianceFlag {        // Domaine 9 — opt-out / do-not-call
  id        String     @id @default(cuid())
  orgId     String
  contactId String?           // email ou téléphone brouillé + type
  value     String            // valeur brouillée (hash)
  type      String            // OPT_OUT | DO_NOT_CALL | SUPPRESSED
  source    String?
  createdAt DateTime   @default(now())
}

model SavedSearch {           // Domaine 6 — recherches sauvegardées + alerte
  id               String   @id @default(cuid())
  orgId            String
  userId           String
  name             String
  filtersJson      Json
  notifyFrequency  String   @default("daily")   // daily | weekly
  lastResultCount  Int      @default(0)
  newSinceNotified Int      @default(0)
  createdAt        DateTime @default(now())
}

model List {                  // Domaine 6
  id      String     @id @default(cuid())
  orgId   String
  ownerId String
  name    String
  type    String     @default("LEADS")   // LEADS | ACCOUNTS
  items   ListItem[]
}

model ListItem {
  id       String @id @default(cuid())
  listId   String
  list     List   @relation(fields: [listId], references: [id], onDelete: Cascade)
  leadId   String?     // ou companyId pour les listes de comptes
  companyId String?
  @@unique([listId, leadId])
  @@unique([listId, companyId])
}

model Sequence {              // Domaine 7 — périmètre minimal en V1
  id         String   @id @default(cuid())
  orgId      String
  name       String
  active     Boolean  @default(true)
  steps      SequenceStep[]
  enrollments SequenceEnrollment[]
}

model SequenceStep {
  id         String   @id @default(cuid())
  sequenceId String
  order      Int
  channel    String   // EMAIL | CALL | TASK
  template   String?
  delayDays  Int      @default(1)
}

model SequenceEnrollment {
  id         String   @id @default(cuid())
  sequenceId String
  leadId     String
  status     String   @default("PENDING")   // PENDING | ACTIVE | DONE | PAUSED | BOUNCED
  nextStepAt DateTime?
  stepIndex  Int      @default(0)
}

model AccessLog {             // Domaine 1 — audit des accès aux données personnelles
  id        String   @id @default(cuid())
  orgId     String
  userId    String
  action    String          // VIEW_CONTACT, EXPORT, VERIFY, DELETE...
  entityType String
  entityId  String
  createdAt DateTime @default(now())
}
```

> À appliquer via : `npx prisma migrate dev --name <sprint>` dans `sales-insight/` (schéma `../generated/prisma`).

---

## 4. Plan phasé — sprints

> Chaque sprint est autonome et vérifiable. Commande de vérification à chaque fin de sprint : `npm run lint` puis `npm run build` dans `sales-insight/`.

### Sprint 0 — Fondations données & confiance (socle V1)
Objectif : le schéma porte la confiance et la traçabilité dès le départ (pas un ajout tardif).

- [x] Étendre `schema.prisma` (section 3) : champs confidence/vérification/source sur `Lead`, firmographie + `technoStack` sur `Company`, nouveaux modèles `BuyingSignal`, `DataSource`, `ComplianceFlag`, `SavedSearch`, `List`, `ListItem`, `Sequence*`, `AccessLog`.
- [x] Migration + `npx prisma generate`.
- [x] Seed Maroc : script `prisma/seed.ts` — 24 entreprises marocaines (Casablanca, Rabat, Tanger, Agadir, Marrakech, Oujda, Meknès, Fès, Tétouan) avec firmographie + `techStack`, 33 contacts avec confidence/vérification/source, signaux d'achat sur 8 comptes, 2 flags compliance (OPT_OUT/DO_NOT_CALL), 1 recherche sauvegardée, 2 listes, 1 séquence 4 étapes avec 3 inscriptions. Scores calculés par le vrai moteur (`computeScoreFromLead`), comptes scorés dans l'org **Beta Test** (plan PRO, `hicham@betatest.ma`). Idempotent (upsert + gardes, inscriptions conservées au re-run). Config `"prisma": { "seed": "tsx prisma/seed.ts" }` dans `package.json` → `npx prisma db seed`.
- [x] Appliquer les quotas `plan-limits.ts` dans `protectedProcedure` (limite de leads/scoring selon plan).

### Sprint 1 — V1 Socle : Companies, Contacts, Prospector (recherche NL + filtres)
Objectif : valider le cœur de données sur le périmètre Maroc.

**Backend**
- [x] `src/lib/trpc/routers/company.ts` : `search` (filtres blocs : effectif min/max, ville/pays, secteur, techStack contient, signaux déclencheurs), `getById` (360°), `exportCsv`.
- [x] Enrichir `leadRouter.list` : filtres blocs contact (poste, séniorité, localisation contact vs entreprise, complétude email).
- [x] Recherche NL → filtres structurés : `src/lib/ai/interpret.ts` (`generateObject` gpt-4o → schéma zod de filtres), appelé par `company.search` quand `query` est fournie (étape 1 du pipeline IA).
- [x] Fonction Inngest `leads.created` → `scoreLead` (existe déjà via `score-leads.ts` ; ajouter `companyId`/`orgId` dans l'event).

**Frontend**
- [x] Page `/dashboard/prospector` : barre de recherche NL + blocs de filtres dépliables (Entreprise / Contact), résultats en temps réel, badges confidence. S'inspirer du style existant (`bg-surface`, `border-border`, composants `ui/`).
- [x] Brancher le Dashboard sur les vraies données (tRPC `lead.list` + counts) au lieu du mock.
- [x] Fiche Lead : afficher score + confiance par champ (badges) ; fiche Compte accessible depuis le prospector.

### Sprint 2 — V2 Intelligence : Copilot réel, scoring expliqué, enrichment waterfall, BuyingSignal
Objectif : différenciation réelle (le Copilot explique, pas seulement score).

- [x] **Scoring expliqué** : modifier `scoring.ts` pour produire aussi une explication NL (`explanation`) stockée dans `scoreExplainability` ; affichage sur la fiche lead/compte ("pourquoi ce compte est prioritaire"). — moteur déterministe (fonctionne sans clé OpenAI) : `computeScoreFromLead` → score 0-100 + intent + 6 facteurs + explication NL ; `rescore` n'exige plus de clé API ; fiche lead affiche l'explication.
- [x] **Copilot branché** : route API `src/app/api/copilot/stream/route.ts` qui appelle `createCopilotStream(orgId, messages)` et renvoie un `ReadableStream` ; la page `/dashboard/copilot` consomme le stream, persiste les messages, ajoute le feedback pouce haut/bas (→ `CopilotMessage.rating`). — mode LLM si `OPENAI_API_KEY`, sinon moteur local data-driven (top leads, pipeline, explication de score) ; persistance dans `CopilotChat`/`CopilotMessage` ; `copilot.rateMessage`.
- [x] **Tool copilot "expliquer un score"** : ajouter un tool dans `copilot.ts` qui relit `scoreExplainability` d'un lead et rédige l'explication. — tool `explainLeadScore` (LLM + mode local).
- [x] **Enrichment waterfall** : refactorer `src/lib/ai/enrichment.ts` en cascade ordonnée (site → DNS/headers → job boards → API publiques → CSV) avec fallback et écriture de `DataSource` ; modes Instant (à la création d'un lead), Scheduled (`scheduled-sync.ts`), On-Demand (upload CSV → route API `api/import`). — `enrichCompany`/`enrichLead`, 5 étapes chacune tracée dans `DataSource` ; événements Inngest `leads.created`/`companies.created` ; route `POST /api/import` (CSV) avec quota.
- [x] **BuyingSignal** : fonction Inngest `detect-signals.ts` (job boards, flux RSS éco locale, changements d'organigramme) → upsert `BuyingSignal` + recompute score des leads rattachés. — déduplication 7 jours, événement `signal.detect` + cron quotidien, enregistré dans `/api/inngest`.
- [x] Fiche Compte 360° : historique des signaux, sources, niveau de confiance par champ. — page `/dashboard/companies/[companyId]` (profil, technographie, buying signals, sources/traçabilité, contacts) liée depuis le Prospector ; navigation dashboard réparée sous `/dashboard/*`.

### Sprint 3 — V3 Engagement : Lists, Saved Searches, Sequences minimales
Objectif : fermer la boucle recherche → action (comme Apollo).

- [x] Routers `list` et `savedSearch` (CRUD + ajout/retrait d'items ; `SavedSearch` avec `filtersJson`). — `listRouter`/`savedSearchRouter` (`list.ts`, `savedSearch.ts`) ; `savedSearch.run` réexécute la recherche, `acknowledge` remet `newSinceNotified` à 0 ; items ajoutés/retirés via `addItem`/`removeItem`.
- [x] Notification nouveaux résultats : job Inngest (cron journalier/hebdo) qui réexécute chaque `SavedSearch`, compare `lastResultCount`, enregistre `newSinceNotified` → badge dans la UI. — fonction `saved-search-check.ts` (cron quotidien) enregistrée dans `/api/inngest` ; badges `+N` affichés sur le Dashboard et la page Saved Searches.
- [x] Router `sequence` : CRUD séquences + étapes, enrollment d'un lead, tâche/rappel (`SequenceEnrollment.nextStepAt`), actions groupées sur une liste. — `sequenceRouter` (`sequence.ts`) : `create` multi-étapes (EMAIL/CALL/TASK, délais), `enroll` par lot (≤100 leads) avec détection de doublons, `getTasks` (enrollments dus) + `advanceTask` ; page Sequences pour créer/inscrire.
- [x] Pages : `/dashboard/lists`, `/dashboard/saved-searches`, `/dashboard/sequences` ; Dashboard "Actions du jour" (relances dues, nouveaux résultats). — entrées Sidebar ajoutées (Lists, Saved Searches, Sequences) ; Dashboard : panneau « Actions du jour » (tâches de séquence dues + bouton « Marquer fait » → `advanceTask`) et panneau « Nouveaux résultats » (badges `+N`).
- [x] **Compliance gate V1** : avant de créer un `SequenceEnrollment`, vérifier `ComplianceFlag` (opt-out/do-not-call) — intégré dans le flux, pas en annexe. — `checkCompliance` dans `sequence.enroll` bloque l'inscription (OPT_OUT/DO_NOT_CALL/SUPPRESSED par contactId ou email/téléphone) et renvoie `blocked` + raison ; résumé `{ enrolled, blocked }` affiché à l'utilisateur.

### Sprint 4 — V4 Confiance & Conformité
Objectif : rattraper Cognism sur la fiabilité perçue.

- [x] Vérification manuelle : `PATCH` contact → `verification = VERIFIED` + `AccessLog` ; UI sur la fiche (bouton "Vérifier", historique). — `lead.setVerification` (VERIFIED/INVALID/UNVERIFIED) écrit `AccessLog` (VERIFY/MARK_INVALID/RESET_VERIFICATION) + `Activity` ; bouton « Vérifier » + panneau « Journal d'accès » sur la fiche lead.
- [x] Compliance : `ComplianceFlag` complet, contrôle systématique avant toute action sortante (guard dans sequences + routes d'export), export partiel opt-out. — router `compliance` (flags CRUD, `check` email/téléphone, `accessLogs`) ; helper partagé `getComplianceBlock` utilisé par `sequence.enroll` (gate) et `lead.exportCsv` (les contacts opt-out/do-not-call/supprimés sont exclus de l'export, compteur `blocked`) ; chaque export journalisé dans `AccessLog` ; page `/dashboard/compliance` + entrée Sidebar.
- [x] Purge programmée : cron Inngest `retention-purge.ts` appliquant la durée de rétention réglementaire. — fonction `retention-purge.ts` (cron quotidien 03h00, `RETENTION_MONTHS` déf. 36) supprime les leads antérieurs à la période (hors CONVERTED, cascade Prisma) et journalise une purge par org dans `AccessLog` ; enregistrée dans `/api/inngest`.
- [x] **i18n fr/ar/en** : `next-intl`, locales pour l'ensemble du dashboard, de l'auth, de la landing `/` et du chrome marketing. — **Sprint i18n livré** : infra « sans routing par préfixe » (pas de `/fr`) pour préserver `src/proxy.ts` (auth) et les 11 specs E2E FR — locale par cookie `NEXT_LOCALE` (défaut `fr`) avec `<html dir="rtl">` pour `ar` (`src/i18n/routing.ts` avec `localeCookie: { name: "NEXT_LOCALE", sameSite: "lax" }`, `src/i18n/request.ts`, `src/i18n/navigation.ts`, plugin `createNextIntlPlugin` dans `next.config.ts`, `src/app/layout.tsx` avec `NextIntlClientProvider`) ; `LanguageSwitcher` (select FR/العربية/English → cookie + `router.refresh()`) intégré au chrome (`(auth)/layout`, `TopBar`, `Sidebar`) ; 17 pages traduites (login, signup, dashboard, prospector, leads, leads/[leadId], lists, saved-searches, sequences, copilot, compliance, companies/[companyId], settings, settings/team, settings/billing) + page 404 globale (`not-found.tsx`), via 3 dictionnaires `messages/fr.json`/`en.json`/`ar.json` (fr source de vérité) ; **landing `/` et chrome marketing traduits en 2e vague** : `components/layout/{Navbar,Footer,PromoBanner,FloatingHelp}.tsx` et `components/landing/{HeroSection,LogoStrip,FeaturesSection,StatsSection,WaitlistSection,CTASection,TestimonialsSection}.tsx`, namespace `landing` ajouté dans les 3 dictionnaires (nav, hero typewriter `phrase1-4`, features + visuels de démo, stats animées, témoignages, waitlist, footer `copyright` avec `{year}`) — composants d'entreprise gardés tels quels (OCP Group, MediPay Maroc…) ; **audit résiduel** : `LeadScoringDemo.tsx` (visuel animé du hero) traduit (`demoAnalyzing`, stat cards `demoStat*`, industries `demoIndustry*`, signaux `demoSignal*`) et `LanguageSwitcher` (aria-label via `common.language` FR/EN/AR) ; **SEO localisé** : `metadata` statique → `generateMetadata` via `getTranslations("meta")` dans `src/app/layout.tsx` (title/description/OG/Twitter par locale, vérifié `<title>` fr/en/ar) ; **finitions code mort** : `TestimonialsSection` réintégrée dans `src/app/page.tsx` (entre Stats et Waitlist — traduite mais jamais rendue, vérifié fr/en/ar) et suppression de `CopilotDemo.tsx` (non importé) ; primitives `ui/*` conservées (scaffold shadcn) ; **audit de parité** : script vérifiant que chaque clé `t()`/`t.rich()` de `src/` existe dans fr/en/ar (0 manquante ; `leads.created`/`companies.created` = noms d'événements Inngest, pas des clés i18n) et que les 3 dictionnaires ont une structure de clés identique ; vérifié par `tsc --noEmit`, `eslint`, `npm test` (12/12), `npm run build` et `npx playwright test` (11/11, suite FR inchangée) + smoke ar (RTL) / en / fr par cookie.

### Sprint 5 — Polissage & go-live (transverse)
- [x] Rate limiting par plan (affiner par coût : LLM vs enrichissement). — `rate-limit.ts` : 3 paliers Upstash par plan (Général `protectedProcedure`, Coûteux `expensiveProcedure` → `lead.rescore`, Copilot → route `/api/copilot/stream`) avec quotas FREE/STARTER/PRO/ENTERPRISE ; les limites sont lues selon `org.plan`.
- [x] Observabilité sur les pipelines Inngest (taux d'échec d'enrichissement, latence). — `src/lib/inngest/observability.ts` (`withMetrics`/`logMetric` JSON structuré) wrap toutes les fonctions (`enrich-company`, `score-leads`, `scheduled-sync` + compteur d'erreurs, `detect-signals`, `saved-search-check`, `retention-purge`) ; note de branchement OTLP (`@inngest/otel`) pour la production ; `INNGEST_DEV=1` ajouté à `.env`/`.env.example` (le endpoint `/api/inngest` répond 200 en local).
- [x] Export CSV des listes (S3/MinIO ou stream), sitemap/robots (déjà présents). — `list.exportCsv` (LEADS : hors opt-out/do-not-call avec compteur `blocked` ; ACCOUNTS : comptes) + journalisation `AccessLog` EXPORT ; bouton « Exporter » sur chaque liste (`/dashboard/lists`) avec téléchargement Blob.
- [x] Tests : tests d'intégration tRPC (multi-tenant) + guard compliance. — vitest installé (`npm test`) ; `tests/compliance.test.ts` (normalisation, gate opt-out/do-not-call/suppression, isolation multi-tenant du gate) et `tests/lead-filter.test.ts` (`buildLeadWhere` impose `organizationId` et traduit les filtres) ; helpers purs extraits dans `src/lib/compliance.ts` et `src/lib/lead-filter.ts` pour une suite sans DB.
- [x] Documenter l'architecture dans `README`/`docs`. — `README.md` réécrit : stack, démarrage, architecture domaine→module, variables d'env, rate limiting par plan, observabilité, tests.

---

## 5. Surface API cible (tRPC)

```
company.search({ query?, filters: { employeesMin, employeesMax, city, country, sector, techStack, signals }, page })
company.getById(id)                    → 360° (score expliqué, signaux, sources, confiance)
lead.list({ intent, status, filters: { title, seniority, contactCity, emailCompleteness }, page })
lead.score(id)                          → recompute + explication
enrichment.enrich(leadId) / .importCsv(file) / .status(jobId)
signal.list({ companyId, from, type })  → flux de signaux
savedSearch.crud / savedSearch.checkNewResults()
list.crud / list.addItem / list.removeItem
sequence.crud / sequence.enroll(leadIds) / sequence.getTasks()
compliance.check(contact) / compliance.flags() / compliance.purge()
copilot.send(...) → stream (route API dédiée)
```

---

## 6. Ordre des priorités & dépendances

```mermaid
Sprint 0 (schéma + seed + quotas) ─▶ Sprint 1 (Prospector + recherche NL + dashboard réel)
                                        │
                                        ▼
                            Sprint 2 (Copilot branché + scoring expliqué + enrichment + BuyingSignal)
                                        │
                                        ▼
                            Sprint 3 (Lists + SavedSearches + Sequences + compliance gate)
                                        │
                                        ▼
                            Sprint 4 (vérification manuelle + compliance complet + purge + i18n)
                                        │
                                        ▼
                            Sprint 5 (rate-limit par coût, observabilité, exports, tests)
```

Règles :
- Ne pas lancer le Sprint 3 avant le Sprint 2 : les séquences consomment les scores expliqués et les signaux.
- Ne pas coder la compliance « en annexe » au Sprint 5 : le gate opt-out du Sprint 3 pose la fondation, le Sprint 4 le complète.
- La recherche NL (Sprint 1) est volontairement basique ; l'interprétation fine + feedback (pouce haut/bas) se fait au Sprint 2 avec le Copilot.

---

## 7. Risques & mitigations

| Risque | Impact | Mitigation |
|---|---|---|
| Coût LLM (gpt-4o sur chaque score/enrichissement) | Budget | Passer scoring/explication sur un modèle moins cher pour le scoring brut ; batch via Inngest ; rate-limit par coût (Sprint 5) |
| Qualité données Maroc/MENA (fournisseurs faibles hors US/EU) | Cœur produit | Pipeline de collecte propre (job boards, pages locales) + source de vérité interne + seed réaliste ; mettre la fraîcheur/confiance en premier |
| Extensibilité des filtres (blocs type Cognism) | Complexité | Filtres en JSON typé (zod) dès Sprint 1, jamais de `where` construit à la main par endpoint |
| Multi-tenant oublié sur un nouveau router | Fuite de données | `ctx.orgId` obligatoire : ajouter un test d'intégration par nouveau router (Sprint 5) + revue de chaque `findMany` |
| Scraping dans le chemin utilisateur | Latence / blocage | Règle absolue : pipeline asynchrone Inngest, jamais de requête réseau tierce dans une procédure tRPC |

---

## 8. Récapitulatif des fichiers à créer / modifier

**À créer**
- `src/lib/trpc/routers/{company,signal,enrichment,list,saved-search,sequence,compliance}.ts`
- `src/app/(dashboard)/prospector/page.tsx`, `lists/page.tsx`, `saved-searches/page.tsx`, `sequences/page.tsx`
- `src/app/api/copilot/stream/route.ts`, `src/app/api/import/route.ts`
- `src/lib/ai/interpret.ts`
- `src/lib/inngest/functions/{detect-signals,retention-purge,saved-search-check}.ts`
- `prisma/seed.ts`
- Locales `fr` / `ar` / `en` (messages JSON)

**À modifier**
- `prisma/schema.prisma` (Sprint 0 puis incréments)
- `src/lib/ai/{scoring,copilot,enrichment}.ts`
- `src/lib/trpc/routers/{lead,organization,copilot}.ts`, `router.ts`, `server.ts`
- `src/app/(dashboard)/dashboard/page.tsx`, `copilot/page.tsx`, `leads/[leadId]/page.tsx`
- `src/lib/plan-limits.ts`, `src/lib/inngest/functions/{enrich-company,scheduled-sync,score-leads}.ts`

Prochaines étapes immédiates : Sprints 0→5 livrés (le Sprint 4 est terminé hors i18n), plus un passage de finition (« Sprint 6 — Polissage ») : seed de démo Maroc idempotent (`prisma/seed.ts`, org **Beta Test** PRO / `hicham@betatest.ma`, 24 entreprises, 33 contacts scorés par le vrai moteur, signaux, compliance, listes, séquence) ; données réelles partout dans la UI (Dashboard : nom/organisation réels + deltas calculés sur 30 j ; page Équipe via `organization.listMembers` ; page Billing via `billing.getSubscription` + bouton de checkout Stripe avec message clair sans clé) ; CTA landing « Start Free Trial » câblés vers `/signup` ; warnings build neutralisés (`turbopack.root` + `baseURL` better-auth + `BETTER_AUTH_URL`) ; reliquat de projet Next obsolète supprimé à la racine du workspace. **Livrés depuis** : sprint **i18n fr/ar/en** complet (infra cookie `NEXT_LOCALE`, 17 pages + landing `/` + layout + SEO localisé, 3 dictionnaires, E2E 11/11), **audit + backfill fraîcheur des données** (seed idempotent : `lastEnrichedAt`/`lastVerifiedAt` + 5 `DataSource`/entreprise + dédup signaux), **export CSV S3/MinIO** avec repli stream local et **traces OpenTelemetry** des fonctions Inngest (`OTEL_EXPORTER_OTLP_ENDPOINT`, no-op sinon). Le plan est à jour : plus aucun item en attente hors déploiement réel.

### Passage de finition complémentaire (après audit des manques fonctionnels)
- Pipeline leads : statut mutable (`lead.setStatus`, select fiche + ligne liste), ajout manuel (`lead.create` + formulaire « Ajouter »), suppression (`lead.delete`, fiche + ligne).
- Vraies données : page Settings réelle (`organization.getCurrent`/`update`, membres, save effectif) ; Sidebar réelle (`organization.me` + `billing.getSubscription`, fini « Beta Test Solutions »/« 420/500 »).
- Actions groupées Prospector : checkboxes Comptes/Contacts + « Ajouter à une liste » (`list.addItems`) + « Inscrire en séquence » (`sequence.enroll`, résumé enrolled/bloqués) — fini l'UI orpheline des listes.
- Pages Leads : pagination (offset/limit + « Préc./Suiv. »), export CSV (`lead.exportCsv`, hors opt-out, feedback bloqués), import CSV UI branché sur `/api/import` (panneau résultat/quota/erreurs).
- Comptes : bouton « Enrichir » (`company.triggerEnrich`).
- Robustesse locale : `sendEvent(name, data, fallback)` exécute le traitement synchrone (scoring/enrichissement) si Inngest est absent → leads importés scorés immédiatement ; `/api/import` envoie désormais un événement par société créée.
- Nettoyage : suppression de `copilot.sendMessage` (doublon mort de `/api/copilot/stream`, sans rate-limit) ; « Annuler l'abonnement » (billing) ; édition des recherches sauvegardées (`savedSearch.update`) ; « Vérifier un contact » (`compliance.check`).
- Vérifié : `npm run lint` (0), `tsc --noEmit`, `npm test` (12/12), `npm run build` (23 routes, sans warning), smoke 200 sur toutes les pages du dashboard.
- Base de démo propre : suppression des orgs orphelines « Démo Maroc » et « Tanger Connect » (aucun membre, données de dev) et de leurs 15 comptes sans lead → base finale : 1 org (Beta Test, PRO), 33 leads, 24 comptes, 3 listes, 2 séquences, compte `hicham@betatest.ma`.
- **E2E Playwright (14/14)** : alignement du schéma sur better-auth 1.6.25 (`Account.password`, timestamps `Account`/`Session`, `User.emailVerified` boolean + `twoFactorEnabled`, `TwoFactor`, `Session.activeOrganizationId`) ; fallback multi-org dans `getOrganizationId` (résout le 500 « No active organization ») ; `src/proxy.ts` (Next 16) protège `/dashboard*` (307 → `/login` sans session) ; toast « Lead ajouté ✓ » déplacé hors du panneau `{showAdd && …}` (était invisible) ; suite `e2e/` (`auth.setup.ts`, `auth.spec.ts`, `prospector.spec.ts`, `leads.spec.ts`, `import.spec.ts`, `company-360.spec.ts`) + `globalTeardown` qui purge les leads/comptes `e2e-*` après chaque run (`npm run cleanup:e2e` standalone). — **Spec de régression fraîcheur ajouté** (`company-360.spec.ts`) : depuis le prospector, ouvre la fiche 360 et vérifie que « Sources & traçabilité » liste les 5 sources (site web, DNS, job boards, API publiques, heuristique, pas de « Aucune source enregistrée. ») et que « Dernier enrichissement » / « Dernière vérification » affichent une date (pas « — ») ; verrouille le backfill fraîcheur. — **Bug réel attrapé par le nouveau spec « prospector : export CSV »** : le bouton CSV du prospector n'avait jamais fonctionné — `downloadCsv` rappelait `trpc.useUtils()` dans le handler (Invalid hook call) au lieu d'utiliser le `utils` hoisté (l.138) ; corrigé (`utils.client.company.exportCsv`), l'export couvre désormais les 3 endpoints (leads, listes, prospector).
- **Audit fraîcheur des données** : cohérence confirmée (33 leads, 0 orphelin, 0 score=0, 24 entreprises toutes avec domaine) mais `lastEnrichedAt`/`lastVerifiedAt` null partout et traçabilité `DataSource` vide (0 ligne) → Company 360 affichait « — » et « Sources & traçabilité » vide pour toutes les entreprises. — **Backfill idempotent dans `prisma/seed.ts`** : timestamps échelonnés sur ~30 jours (24 entreprises `lastEnrichedAt`/`lastVerifiedAt`, 33 leads `lastEnrichedAt` calé sur leur entreprise) + 5 lignes `DataSource`/entreprise (website, dns, job_board, public_api, heuristic — miroir de `enrichment.ts`) seulement si absentes ; **bug corrigé au passage** : les `BuyingSignal` du seed étaient recréés sans dedup à chaque re-seed (171 lignes accumulées → 19 canoniques du mapping `SIGNALS`), désormais `deleteMany(source: "Seed démo")` + `createMany`. Re-seed testé (base stable 33 leads / 24 comptes), `tsc`/`lint` 0, E2E 11/11 après backfill.
- **Export CSV S3/MinIO + repli local** : `@aws-sdk/client-s3` installé ; helper serveur `src/lib/export-storage.ts` (`uploadExportToStorage`, `server-only`, repli automatique sur le stream local en cas d'erreur ou de config absente) + helper client `src/lib/download.ts` (`triggerDownload`). Les 3 endpoints `list.exportCsv` / `lead.exportCsv` / `company.exportCsv` renvoient désormais `{ url, csv, … }` (url non nulle quand S3 activé, sinon csv) ; les 3 clients (lists, leads, prospector) passent par `triggerDownload`. Env `S3_ENABLED`/`S3_ENDPOINT`/`S3_REGION`/`S3_BUCKET`/`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`/`S3_FORCE_PATH_STYLE`/`S3_PUBLIC_BASE_URL` documentés dans `.env.example` + README (instruction MinIO Docker + création bucket). Vérifié : `tsc` 0, `lint` 0, `npm test` 12/12, `build` OK (23 pages), E2E 11/11 (le spec « leads : export CSV » exerce le repli Blob). — **Testé en réel contre MinIO local (Docker, `docker run minio/minio` + bucket lecture publique)** : `PutObject` réussi, endpoint renvoyant l'URL S3, téléchargement navigateur de l'objet (requête `:9000` observée) — chemin S3 complet confirmé, pas seulement le repli Blob. **Correctif au passage** : le regex de `safeName` retirait l'extension de la clé objet (`leads.csv` → objet `leads_csv`) ; désormais `[^a-z0-9-_.]` autorise le point → objet `exports/<date>/leads.csv`.
- **Traces OpenTelemetry (Inngest)** : sans recourir à `@inngest/otel` (package side-effect lourd, arbre de déps +28 vulns — rejeté), spans branchés dans l'existant `withMetrics` de `src/lib/inngest/observability.ts` (toutes les 6 fonctions y passent) via `@opentelemetry/api` (`trace.getTracer("sales-insight")`, span `inngest.<fn>`, statut OK/ERROR + `recordException`, attribut `durationMs`) ; `src/lib/otel.ts` (`server-only`) démarre un `NodeSDK` + `OTLPTraceExporter` HTTP si `OTEL_EXPORTER_OTLP_ENDPOINT` est défini (`OTEL_SERVICE_NAME` optionnel), sinon no-op strict ; initialisé au chargement de `/api/inngest` (`route.ts`). Déps ajoutées : `@opentelemetry/sdk-node`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/api`. `.env.example` + README documentés. Vérifié : `tsc` 0, `lint` 0, `build` OK (23 pages), E2E 11/11 (OTel inactif → aucun impact). — **Testé en réel** : collector OTLP local (Docker `otel/opentelemetry-collector-contrib`, récepteur HTTP 4318) + dev server Inngest (`npx inngest-cli dev`) → envoi des événements `leads.created` (2 vrais leads) et `signal.detect` ; le collector reçoit les spans de l'app (`service.name=sales-insight`) : `inngest.score-leads` (`count=2 durationMs=271`), `inngest.detect-signals` (`durationMs=2137`), spans SDK `inngest.execution` (scope `inngest@4.13.0`) + spans Next.js auto-instrumentés (`next.span_name` sur `/api/inngest`). Intégrité DB intacte après les runs (33 leads / 24 comptes / 19 signaux / 120 sources). Note découverte : en dev, sans `npx inngest-cli dev` actif, `inngest.send` échoue et le fallback synchrone prend le relais — les fonctions (et donc les spans) ne s'exécutent qu'avec le dev server.
- **Analyse `npm audit` (9 vulns : 5 modérées, 4 hautes)** : `npm audit fix --dry-run` montre que la correction non-breaking ajouterait 145 paquets (binaires de plateforme) et bumperait `inngest` 4.13→4.14 **sans réduire le compte de vulnérabilités (reste 9/9)** — non exécutée. Les 4 hautes sont `postcss ≤8.5.17` et `sharp <0.35.0` **embarqués par Next 16.2.11** ; la seule « fix » proposée est un downgrade cassant vers `next@9.3.3` (rejetée). Action à prévoir : résolues par un futur patch Next (upgrade de framework), non pas par un audit fix. Les modérées (`@hono/node-server` via `@modelcontextprotocol/sdk`, `brace-expansion` via `glob`/`@ts-morph/common`) touchent l'outillage dev/transitif, pas le runtime applicatif.

---

## 9. État de livraison & contrôle de version

- **Qualité** : `tsc --noEmit` 0, `eslint` 0, `npm test` 12/12 (vitest), `npm run build` OK (23 routes + proxy, sans warning), **E2E Playwright 14/14** (dev server fraîchement redémarré — le `.next` partagé entre `next dev` et `next build` provoque des erreurs transitoires sinon).
- **Smoke production réel** : `next build` puis `next start -p 3002` → `/` 200, `/login` 200, `/dashboard` 307 → `/login`, `/sitemap.xml` + `/robots.txt` 200 ; serveur et logs nettoyés.
- **Intégrations validées en réel** : S3/MinIO (PutObject + téléchargement navigateur, bucket public) ; OpenTelemetry (collector OTLP HTTP 4318, spans `inngest.score-leads` / `inngest.detect-signals` / `inngest.execution`). En dev sans `npx inngest-cli dev` : repli synchrone (pas de fonctions/spans).
- **Sécurité du dépôt** : `.env` ignoré (aucun secret commité, scan secrets OK), `.env.example` versionné (`!.env.example`), artefacts E2E/logs ignorés.
- **Git** : `git init` sur `master` — `2cf1149` « feat: sales insight, CRM de prospection B2B » (173 fichiers), `eb497fe` « ci: workflow GitHub Actions (qualité + e2e postgres), pin node 22 », `170aa46` « docs », `5066152` « fix: recherche NL sans clé OpenAI, clés i18n dashboard manquantes, DATABASE_URL build CI ». `.nvmrc` (Node 22) + `engines` dans `package.json`.
- **Remote GitHub** : `Lahbiri-Nezha/sales-insight` (**privé**, branche par défaut `master`, `develop` vide supprimée) — push effectué.
- **CI exécuté sur GitHub et vert** : run `30831478795` → job `quality` **success** + job `e2e` **success**. Il a révélé et verrouillé 2 vrais bugs : (1) le build CI échouait faute de `DATABASE_URL` (ajoutée au job `quality`) ; (2) la recherche NL en fallback sans clé OpenAI cherchait la phrase entière en `contains` → « Aucun compte trouvé » ; corrigée en tokenisation OR (mots-clés + stopwords FR + `headquartersCity`) dans `buildWhere` (`src/lib/trpc/routers/company.ts`). **Bonus i18n** : les clés `dashboard.prospectorLink` / `sequencesLink` / `savedSearchesLink` manquaient dans les 3 dictionnaires (le dashboard affichait des clés brutes) → ajoutées (fr/en/ar). Audit statique i18n ultérieur : 31 fichiers, aucune clé manquante.
- **À faire pour aller en production** : config des vraies variables d'env (DATABASE_URL, BETTER_AUTH_SECRET/URL, OPENAI_API_KEY, STRIPE, UPSTASH, S3, OTLP) et déploiement (Vercel/Fly) — nécessite les credentials du compte de déploiement ; aucun CLI (vercel/flyctl/netlify) ni config locale présente à ce jour.
- **Artifact Docker de production livré et validé en réel** : `output: "standalone"` ajouté à `next.config.ts` ; `Dockerfile` multi-stage (deps → builder avec `npm run build` → runner Node 22 slim non-root, `EXPOSE 3000`, healthcheck `/login`, `prisma/` embarqué, `ARG DATABASE_URL` factice pour le build) ; `.dockerignore` ; `docker-compose.yml` (PostgreSQL 16 healthy + MinIO avec création du bucket `sales-exports` lecture publique + app). **Testé en réel** : `docker build -t sales-insight:prod` OK (Linux, build standalone ≈ 55 s) ; base Postgres temporaire (port 5433) migrée + seed (33 leads / 24 comptes / 1 user) ; conteneur app lancé → **healthy**, `/` 200, `/login` 200, `/sitemap.xml` + `/robots.txt` 200, `/api/inngest` 200, `/dashboard` → 307 `/login` (proxy Next 16). Note : le build local Windows avec standalone est très lent (copie nft de node_modules) — privilégier Docker/CI (Linux) pour `npm run build` ; le CI qualité l'exécute à chaque push.
- **Chaîne de publication GHCR testée en réel** : workflow `.github/workflows/release.yml` (déclenché sur tag `v*`, permissions `contents: read` + `packages: write`, build multi-étapes + push vers `ghcr.io/lahbiri-nezha/sales-insight` via `GITHUB_TOKEN` — aucun secret perso requis) ; testé avec le tag `v0.1.0` : run **success**, image publiée (`:v0.1.0` + `:latest`), vérifiable par `docker pull` une fois le scope `read:packages` ajouté au token local (`gh auth refresh -h github.com -s read:packages,write:packages`). `.gitattributes` ajouté (stockage LF des sources, plus de churn CRLF).
