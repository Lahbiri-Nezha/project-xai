import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "@better-auth/utils/password";
import {
  PrismaClient,
  Plan,
  OrgRole,
  ComplianceType,
  Channel,
  SequenceEnrollmentStatus,
  ListType,
  VerificationStatus,
} from "../generated/prisma/client";
import type { Prisma } from "../generated/prisma/client";
import { computeScoreFromLead } from "../src/lib/ai/scoring";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

const emailOf = (first: string, last: string, domain: string) =>
  `${slug(first)}.${slug(last)}@${domain}`;

type CompanySeed = {
  name: string;
  domain: string;
  city: string;
  industry: string;
  employees: number;
  fundingStage?: string;
  fundingAmount?: number;
  revenueEstimate?: number;
  techStack: string[];
};

const COMPANIES: CompanySeed[] = [
  { name: "Atlas Logistique SA", domain: "atlaslogistique.ma", city: "Casablanca", industry: "Logistique", employees: 320, revenueEstimate: 45, techStack: ["HubSpot", "Zapier"] },
  { name: "MedTech Solutions", domain: "medtech-solutions.ma", city: "Casablanca", industry: "Santé", employees: 85, fundingStage: "Série A", fundingAmount: 2, revenueEstimate: 12, techStack: ["Salesforce", "Tableau"] },
  { name: "KechTech", domain: "kechtech.ma", city: "Marrakech", industry: "E-commerce", employees: 45, fundingStage: "Seed", fundingAmount: 0.5, revenueEstimate: 4, techStack: ["Shopify", "HubSpot"] },
  { name: "Atlas Bank Digital", domain: "atlasbank.ma", city: "Casablanca", industry: "Banque & Assurances", employees: 1250, revenueEstimate: 300, techStack: ["SAP", "Microsoft Dynamics"] },
  { name: "Maroc Agro Export", domain: "agroexport.ma", city: "Agadir", industry: "Agroalimentaire", employees: 210, revenueEstimate: 28, techStack: ["SAP"] },
  { name: "GreenEnergy Maroc", domain: "greenenergy.ma", city: "Oujda", industry: "Énergie", employees: 60, fundingStage: "Série B", fundingAmount: 8, revenueEstimate: 15, techStack: ["Salesforce", "Power BI"] },
  { name: "Digitrans", domain: "digitrans.ma", city: "Tanger", industry: "Logistique", employees: 130, revenueEstimate: 22, techStack: ["HubSpot", "Zapier"] },
  { name: "Edunova", domain: "edunova.ma", city: "Rabat", industry: "Éducation", employees: 95, fundingStage: "Seed", fundingAmount: 0.8, revenueEstimate: 6, techStack: ["Notion", "Slack", "HubSpot"] },
  { name: "ImmoPro Casablanca", domain: "immopro.ma", city: "Casablanca", industry: "Immobilier", employees: 55, revenueEstimate: 9, techStack: ["HubSpot"] },
  { name: "Telmar Telecom", domain: "telmar.ma", city: "Rabat", industry: "Télécommunications", employees: 480, revenueEstimate: 55, techStack: ["Microsoft Dynamics"] },
  { name: "Atlas Fintech", domain: "atlasfintech.ma", city: "Casablanca", industry: "Fintech", employees: 75, fundingStage: "Série A", fundingAmount: 3.5, revenueEstimate: 8, techStack: ["Stripe", "HubSpot"] },
  { name: "Casa Digital Agency", domain: "casadigital.ma", city: "Casablanca", industry: "Marketing Digital", employees: 28, revenueEstimate: 2.4, techStack: ["HubSpot", "Slack"] },
  { name: "TangerMed Port Services", domain: "tangermed.ma", city: "Tanger", industry: "Logistique", employees: 900, revenueEstimate: 120, techStack: ["SAP"] },
  { name: "Pharma Atlas", domain: "pharmaatlas.ma", city: "Casablanca", industry: "Santé", employees: 160, revenueEstimate: 25, techStack: ["SAP", "Salesforce"] },
  { name: "Rif Travel", domain: "riftravel.ma", city: "Tétouan", industry: "Tourisme", employees: 42, revenueEstimate: 5.5, techStack: ["HubSpot"] },
  { name: "OCP Services IT", domain: "ocpservices.ma", city: "Casablanca", industry: "Industrie", employees: 320, revenueEstimate: 40, techStack: ["SAP", "ServiceNow"] },
  { name: "SoukOnline", domain: "soukonline.ma", city: "Casablanca", industry: "E-commerce", employees: 110, fundingStage: "Série B", fundingAmount: 12, revenueEstimate: 18, techStack: ["Shopify", "Klaviyo", "HubSpot"] },
  { name: "Rabat Smart City", domain: "rabatsmartcity.ma", city: "Rabat", industry: "Énergie", employees: 50, fundingStage: "Seed", fundingAmount: 1.2, revenueEstimate: 3, techStack: ["AWS", "Salesforce"] },
  { name: "Fès Artisanat Export", domain: "fesartisanat.ma", city: "Fès", industry: "Agroalimentaire", employees: 38, revenueEstimate: 4, techStack: ["Notion"] },
  { name: "Maroc Leasing", domain: "marocleasing.ma", city: "Casablanca", industry: "Banque & Assurances", employees: 260, revenueEstimate: 35, techStack: ["SAP"] },
  { name: "Agritech Maroc", domain: "agritech.ma", city: "Meknès", industry: "Agroalimentaire", employees: 68, fundingStage: "Série A", fundingAmount: 2.2, revenueEstimate: 7, techStack: ["Salesforce", "IoT"] },
  { name: "Atlas Cloud", domain: "atlascloud.ma", city: "Casablanca", industry: "Informatique", employees: 140, fundingStage: "Série C", fundingAmount: 25, revenueEstimate: 20, techStack: ["AWS", "Kubernetes", "HubSpot"] },
  { name: "Halal Logistics", domain: "halallogistics.ma", city: "Casablanca", industry: "Logistique", employees: 88, revenueEstimate: 11, techStack: ["HubSpot"] },
  { name: "Casablanca Soft", domain: "casasoft.ma", city: "Casablanca", industry: "Informatique", employees: 200, revenueEstimate: 16, techStack: ["Salesforce", "HubSpot"] },
];

const SIGNALS: Record<string, { type: string; intensity: number }[]> = {
  "atlasfintech.ma": [
    { type: "HIRING", intensity: 3 },
    { type: "FUNDING", intensity: 3 },
    { type: "TECH_MATCH", intensity: 2 },
  ],
  "soukonline.ma": [
    { type: "HIRING", intensity: 3 },
    { type: "TECH_MATCH", intensity: 2 },
    { type: "FUNDING", intensity: 2 },
  ],
  "greenenergy.ma": [
    { type: "HIRING", intensity: 2 },
    { type: "FUNDING", intensity: 3 },
  ],
  "medtech-solutions.ma": [
    { type: "TECH_MATCH", intensity: 3 },
    { type: "HIRING", intensity: 2 },
  ],
  "agritech.ma": [
    { type: "HIRING", intensity: 2 },
    { type: "TECH_MATCH", intensity: 3 },
  ],
  "atlascloud.ma": [
    { type: "HIRING", intensity: 3 },
    { type: "TECH_MATCH", intensity: 2 },
    { type: "PRICING_PAGE", intensity: 2 },
  ],
  "digitrans.ma": [
    { type: "HIRING", intensity: 2 },
    { type: "TECH_MATCH", intensity: 2 },
  ],
  "edunova.ma": [
    { type: "FUNDING", intensity: 2 },
    { type: "TECH_MATCH", intensity: 2 },
  ],
};

type ContactSeed = {
  domain: string;
  first: string;
  last: string;
  title: string;
  verified?: boolean;
  invalid?: boolean;
};

const CONTACTS: ContactSeed[] = [
  { domain: "atlaslogistique.ma", first: "Karim", last: "Benjelloun", title: "CEO" },
  { domain: "atlaslogistique.ma", first: "Salma", last: "El Fassi", title: "Head of Sales", verified: true },
  { domain: "medtech-solutions.ma", first: "Yassine", last: "Amrani", title: "CTO" },
  { domain: "medtech-solutions.ma", first: "Nadia", last: "Bouzidi", title: "Directeur Achats", verified: true },
  { domain: "kechtech.ma", first: "Mehdi", last: "Tazi", title: "Founder" },
  { domain: "atlasbank.ma", first: "Rim", last: "Chakir", title: "Responsable Transformation Digitale" },
  { domain: "atlasbank.ma", first: "Omar", last: "Belhaj", title: "CIO", verified: true },
  { domain: "agroexport.ma", first: "Imane", last: "Zerouali", title: "Export Manager" },
  { domain: "greenenergy.ma", first: "Adil", last: "Sekkat", title: "CEO", verified: true },
  { domain: "greenenergy.ma", first: "Hind", last: "Lahlou", title: "Directeur Marketing" },
  { domain: "digitrans.ma", first: "Rachid", last: "Oudghiri", title: "Operations Director" },
  { domain: "digitrans.ma", first: "Meryem", last: "Berrada", title: "Sales Manager", verified: true },
  { domain: "edunova.ma", first: "Hassan", last: "Kabbaj", title: "Founder & CEO" },
  { domain: "immopro.ma", first: "Sara", last: "Bennani", title: "Directeur Commercial", verified: true },
  { domain: "telmar.ma", first: "Tarik", last: "Ouazzani", title: "IT Director" },
  { domain: "atlasfintech.ma", first: "Leila", last: "Fikri", title: "CEO", verified: true },
  { domain: "atlasfintech.ma", first: "Amine", last: "Chraibi", title: "VP Engineering" },
  { domain: "atlasfintech.ma", first: "Kenza", last: "Belkadi", title: "Head of Growth" },
  { domain: "casadigital.ma", first: "Driss", last: "Alaoui", title: "Founder" },
  { domain: "tangermed.ma", first: "Sofia", last: "Benslimane", title: "Procurement Manager" },
  { domain: "pharmaatlas.ma", first: "Youssef", last: "Amazouz", title: "Directeur Qualité" },
  { domain: "riftravel.ma", first: "Hanae", last: "El Idrissi", title: "Sales Lead" },
  { domain: "ocpservices.ma", first: "Mohamed", last: "El Ghazi", title: "Digital Officer", verified: true },
  { domain: "soukonline.ma", first: "Nisrine", last: "Mansouri", title: "CMO" },
  { domain: "soukonline.ma", first: "Ayoub", last: "Naciri", title: "CTO", verified: true },
  { domain: "rabatsmartcity.ma", first: "Ghita", last: "Ramdani", title: "Project Director" },
  { domain: "fesartisanat.ma", first: "Badr", last: "Cherkaoui", title: "Manager" },
  { domain: "marocleasing.ma", first: "Ilham", last: "Sabri", title: "Directeur Commercial", verified: true },
  { domain: "agritech.ma", first: "Aziz", last: "Bouazza", title: "CTO" },
  { domain: "atlascloud.ma", first: "Majda", last: "Tahiri", title: "Head of Sales", verified: true },
  { domain: "atlascloud.ma", first: "Reda", last: "Ziani", title: "VP Product" },
  { domain: "halallogistics.ma", first: "Asma", last: "Gharbi", title: "Operations Manager" },
  { domain: "casasoft.ma", first: "Walid", last: "Idrissi", title: "CEO" },
];

async function main() {
  console.log("→ Seed Sales Insight (Maroc / MENA)");

  const user = await prisma.user.upsert({
    where: { email: "hicham@betatest.ma" },
    update: {},
    create: { email: "hicham@betatest.ma", name: "Hicham Benali", emailVerified: true },
  });

  const org = await prisma.organization.upsert({
    where: { slug: "betatest" },
    update: { plan: Plan.PRO },
    create: { name: "Beta Test", slug: "betatest", plan: Plan.PRO },
  });

  await prisma.organizationMembership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    update: { role: OrgRole.OWNER },
    create: { userId: user.id, organizationId: org.id, role: OrgRole.OWNER },
  });

  // Compte credential (mot de passe) pour la connexion par email.
  const passwordHash = await hashPassword(process.env.SEED_PASSWORD ?? "Hicham2026!");
  await prisma.account.deleteMany({
    where: { userId: user.id, providerId: "credential" },
  });
  await prisma.account.create({
    data: {
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: passwordHash,
    },
  });

  console.log(`→ Utilisateur ${user.email} · org ${org.name} (${org.plan})`);

  // ── Entreprises (upsert par domaine) ────────────────────────────────
  const newCompanies: { id: string; domain: string }[] = [];
  for (const c of COMPANIES) {
    const company = await prisma.company.upsert({
      where: { organizationId_domain: { organizationId: org.id, domain: c.domain } },
      update: {},
      create: {
        organizationId: org.id,
        name: c.name,
        domain: c.domain,
        industry: c.industry,
        employeeCount: c.employees,
        fundingStage: c.fundingStage,
        fundingAmount: c.fundingAmount,
        revenueEstimate: c.revenueEstimate,
        headquartersCity: c.city,
        headquartersCountry: "Maroc",
        techStack: c.techStack,
      },
    });
    newCompanies.push({ id: company.id, domain: c.domain });
  }
  console.log(`→ ${COMPANIES.length} entreprises (upsert)`);

  // ── Buying signals (uniquement pour les nouvelles entreprises) ───────
  for (const c of newCompanies) {
    const sigs = SIGNALS[c.domain];
    if (!sigs) continue;
    await prisma.buyingSignal.deleteMany({ where: { companyId: c.id, source: "Seed démo" } });
    await prisma.buyingSignal.createMany({
      data: sigs.map((s) => ({
        companyId: c.id,
        type: s.type as never,
        intensity: s.intensity,
        source: "Seed démo",
        detectedAt: new Date(Date.now() - Math.floor(Math.random() * 14) * 86400000),
      })),
    });
  }
  console.log("→ Signaux d'achat créés");

  // ── Contacts (leads) avec scoring réel ───────────────────────────────
  const createdLeads: { id: string; intent: string; email: string }[] = [];
  let skipped = 0;

  for (const contact of CONTACTS) {
    const company = newCompanies.find((c) => c.domain === contact.domain);
    if (!company) continue;

    const full = await prisma.company.findUnique({ where: { id: company.id } });
    const signals = (SIGNALS[contact.domain] ?? []).map((s) => ({
      type: s.type,
      value: s.type,
      weight: s.intensity,
    }));

    const email = emailOf(contact.first, contact.last, contact.domain);
    const existing = await prisma.lead.findFirst({
      where: { organizationId: org.id, email },
      select: { id: true },
    });
    if (existing) {
      const existingSignals = await prisma.signal.count({
        where: { leadId: existing.id },
      });
      if (existingSignals === 0) {
        await prisma.signal.createMany({
          data: signals.map((s) => ({
            leadId: existing.id,
            type: s.type as never,
            value: s.type,
            weight: s.weight,
            source: "Seed démo",
          })),
        });
      }
      skipped++;
      continue;
    }

    const verification = contact.invalid
      ? VerificationStatus.INVALID
      : contact.verified
        ? VerificationStatus.VERIFIED
        : VerificationStatus.UNVERIFIED;

    const result = computeScoreFromLead({
      firstName: contact.first,
      lastName: contact.last,
      email,
      phone: `+212661${String(Math.floor(100000 + Math.random() * 899999))}`,
      title: contact.title,
      verification,
      confidenceEmail: 0.7 + Math.random() * 0.25,
      confidencePhone: 0.5 + Math.random() * 0.4,
      confidenceTitle: contact.title ? 0.8 + Math.random() * 0.2 : 0,
      company: {
        name: full?.name ?? null,
        industry: full?.industry ?? null,
        employeeCount: full?.employeeCount ?? null,
        revenueEstimate: full?.revenueEstimate ?? null,
        fundingStage: full?.fundingStage ?? null,
        techStack: full?.techStack ?? [],
      },
      signals,
    });

    const lead = await prisma.lead.create({
      data: {
        organizationId: org.id,
        firstName: contact.first,
        lastName: contact.last,
        email,
        phone: `+212661${String(Math.floor(100000 + Math.random() * 899999))}`,
        title: contact.title,
        companyId: company.id,
        score: result.score,
        intent: result.intent as never,
        verification,
        confidenceEmail: 0.7 + Math.random() * 0.25,
        confidencePhone: 0.5 + Math.random() * 0.4,
        confidenceTitle: contact.title ? 0.8 + Math.random() * 0.2 : 0,
        source: "Seed démo",
        scoreExplainability: {
          factors: result.factors,
          explanation: result.explanation,
        } as unknown as Prisma.InputJsonValue,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 60) * 86400000),
        signals: {
          create: signals.map((s) => ({
            type: s.type as never,
            value: s.type,
            weight: s.weight,
            source: "Seed démo",
          })),
        },
      },
    });
    createdLeads.push({ id: lead.id, intent: result.intent, email });
  }
  console.log(`→ ${createdLeads.length} leads créés (${skipped} déjà présents, ignorés)`);

  // ── Compliance flags (réinitialisés : source "seed") ─────────────────
  const optOutEmail = emailOf("Karim", "Benjelloun", "atlaslogistique.ma");
  await prisma.complianceFlag.deleteMany({ where: { organizationId: org.id, source: "seed" } });
  await prisma.complianceFlag.createMany({
    data: [
      { organizationId: org.id, contactId: createdLeads.find((l) => l.email === optOutEmail)?.id ?? null, value: optOutEmail, type: ComplianceType.OPT_OUT, source: "seed" },
      { organizationId: org.id, contactId: createdLeads.find((l) => l.email === emailOf("Salma", "El Fassi", "atlaslogistique.ma"))?.id ?? null, value: "+212661000000", type: ComplianceType.DO_NOT_CALL, source: "seed" },
    ],
  });
  console.log("→ Flags compliance (OPT_OUT, DO_NOT_CALL)");

  // ── Recherche sauvegardée ────────────────────────────────────────────
  await prisma.savedSearch.deleteMany({ where: { organizationId: org.id, name: "Fintech à Casablanca" } });
  await prisma.savedSearch.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      name: "Fintech à Casablanca",
      filtersJson: { city: "Casablanca", industry: "Fintech" },
      notifyFrequency: "daily",
      lastResultCount: 4,
      newSinceNotified: 2,
    },
  });
  console.log("→ Recherche sauvegardée « Fintech à Casablanca »");

  // ── Listes ───────────────────────────────────────────────────────────
  const techLeads = createdLeads.slice(0, 5).map((l) => l.id);
  const leadsList = await prisma.list.upsert({
    where: { id: "seed-tech-casa" },
    update: {},
    create: { id: "seed-tech-casa", organizationId: org.id, ownerId: user.id, name: "Leads Tech Casablanca", type: ListType.LEADS },
  });
  await prisma.listItem.deleteMany({ where: { listId: leadsList.id } });
  await prisma.listItem.createMany({
    data: techLeads.map((leadId) => ({ listId: leadsList.id, leadId })),
  });

  const accountsList = await prisma.list.upsert({
    where: { id: "seed-accounts-prio" },
    update: {},
    create: { id: "seed-accounts-prio", organizationId: org.id, ownerId: user.id, name: "Comptes prioritaires 2026", type: ListType.ACCOUNTS },
  });
  await prisma.listItem.deleteMany({ where: { listId: accountsList.id } });
  const prioCompanies = newCompanies
    .filter((c) => SIGNALS[c.domain])
    .slice(0, 3)
    .map((c) => c.id);
  await prisma.listItem.createMany({
    data: prioCompanies.map((companyId) => ({ listId: accountsList.id, companyId })),
  });
  console.log("→ Listes « Leads Tech Casablanca » + « Comptes prioritaires 2026 »");

  // ── Séquence + enrollment des leads chauds ───────────────────────────
  const existingSequence = await prisma.sequence.findFirst({
    where: { organizationId: org.id, name: "Démarrage Beta Test" },
    include: { _count: { select: { enrollments: true } } },
  });

  if (existingSequence && existingSequence._count.enrollments > 0) {
    console.log("→ Séquence « Démarrage Beta Test » existante (inscriptions conservées)");
  } else {
    if (existingSequence) {
      await prisma.sequence.delete({ where: { id: existingSequence.id } });
    }
    const sequence = await prisma.sequence.create({
    data: {
      organizationId: org.id,
      name: "Démarrage Beta Test",
      active: true,
      steps: {
        create: [
          { order: 0, channel: Channel.EMAIL, delayDays: 1, template: "Bonjour {firstName}, nous avons identifié que votre équipe pourrait..." },
          { order: 1, channel: Channel.CALL, delayDays: 3, template: "Appel de découverte — préparer les points de douleur du secteur." },
          { order: 2, channel: Channel.EMAIL, delayDays: 5, template: "Suite à notre échange, voici une étude de cas client similaire." },
          { order: 3, channel: Channel.TASK, delayDays: 7, template: "Relance personnalisée par WhatsApp / LinkedIn." },
        ],
      },
    },
  });

  let hotLeads = createdLeads.filter((l) => l.intent === "HOT").slice(0, 3);
    if (hotLeads.length === 0) {
      const existingHot = await prisma.lead.findMany({
        where: { organizationId: org.id, intent: "HOT" },
        select: { id: true },
        take: 3,
      });
      hotLeads = existingHot.map((l) => ({ id: l.id, intent: "HOT", email: "" }));
    }
    if (hotLeads.length > 0) {
    await prisma.sequenceEnrollment.createMany({
      data: hotLeads.map((l) => ({
        sequenceId: sequence.id,
        leadId: l.id,
        status: SequenceEnrollmentStatus.ACTIVE,
        stepIndex: 0,
        nextStepAt: new Date(Date.now() + 1 * 86400000),
      })),
    });
  }
    console.log(`→ Séquence « Démarrage Beta Test » · ${hotLeads.length} inscriptions`);
  }

  // ── Fraîcheur : backfill enrichissement / vérification / traçabilité ──
  const companiesToBackfill = await prisma.company.findMany({
    select: {
      id: true,
      domain: true,
      lastEnrichedAt: true,
      lastVerifiedAt: true,
      _count: { select: { dataSources: true } },
    },
  });
  const companyEnrichedAt = new Map<string, Date>();
  for (const company of companiesToBackfill) {
    const enrichedAt =
      company.lastEnrichedAt ??
      new Date(Date.now() - Math.floor(1 + Math.random() * 29) * 86400000);
    const verifiedAt =
      company.lastVerifiedAt ??
      new Date(enrichedAt.getTime() - Math.floor(1 + Math.random() * 3) * 86400000);
    companyEnrichedAt.set(company.id, enrichedAt);
    if (!company.lastEnrichedAt || !company.lastVerifiedAt) {
      await prisma.company.update({
        where: { id: company.id },
        data: { lastEnrichedAt: enrichedAt, lastVerifiedAt: verifiedAt },
      });
    }
    if (company._count.dataSources === 0) {
      await prisma.dataSource.createMany({
        data: [
          { companyId: company.id, kind: "website", url: `https://${company.domain}`, payload: { ok: true, note: "Indexation du site (backfill démo)", tech: [] }, fetchedAt: enrichedAt },
          { companyId: company.id, kind: "dns", payload: { ok: true, note: "Analyse DNS / en-têtes", tech: [] }, fetchedAt: enrichedAt },
          { companyId: company.id, kind: "job_board", url: `https://${company.domain}/feed/`, payload: { ok: true, note: "Flux carrières" }, fetchedAt: enrichedAt },
          { companyId: company.id, kind: "public_api", payload: { ok: true, note: "Base publique marocaine" }, fetchedAt: enrichedAt },
          { companyId: company.id, kind: "heuristic", payload: { note: "Corrélation secteur / effectifs" }, fetchedAt: enrichedAt },
        ],
      });
    }
  }
  const leadsMissingEnriched = await prisma.lead.findMany({
    where: { lastEnrichedAt: null },
    select: { id: true, companyId: true, createdAt: true },
  });
  let leadBackfilled = 0;
  for (const lead of leadsMissingEnriched) {
    const base = lead.companyId ? companyEnrichedAt.get(lead.companyId) : undefined;
    const when =
      base ??
      new Date(
        Math.min(lead.createdAt.getTime() + Math.floor(Math.random() * 5) * 86400000, Date.now()),
      );
    await prisma.lead.update({ where: { id: lead.id }, data: { lastEnrichedAt: when } });
    leadBackfilled++;
  }
  console.log(
    `→ Fraîcheur : ${companiesToBackfill.length} entreprises (lastEnrichedAt/lastVerifiedAt + sources), ${leadBackfilled} leads (lastEnrichedAt)`,
  );

  const totalLeads = await prisma.lead.count({ where: { organizationId: org.id } });
  const totalCompanies = await prisma.company.count();
  console.log("─────────────────────────────");
  console.log(`Seed terminé : ${totalLeads} leads, ${totalCompanies} entreprises.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
