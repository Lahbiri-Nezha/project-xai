import { prisma } from "@/lib/prisma";
import dns from "node:dns";
import type { Prisma } from "../../../generated/prisma/client";

export interface EnrichmentResult {
  industry?: string;
  employeeCount?: number;
  revenueEstimate?: number;
  fundingStage?: string;
  fundingAmount?: number;
  techStack: string[];
  summary?: string;
  steps: { kind: string; ok: boolean; note: string }[];
}

const TECH_MARKERS: Record<string, RegExp> = {
  react: /(?:data-reactroot|react|_next\/static)/i,
  nextjs: /_next\/static/i,
  wordpress: /wp-content|wp-includes|wordpress/i,
  shopify: /cdn\.shopify|shopify/i,
  cloudflare: /cloudflare/i,
  aws: /amazonaws|cloudfront|elasticbeanstalk/i,
  google_analytics: /gtag|google-analytics|analytics\.google/i,
  facebook_pixel: /connect\.facebook|fbq\(/i,
  intercom: /intercom/i,
  stripe: /js\.stripe|stripe\.com\/v3/i,
  hotjar: /hotjar/i,
  segment: /segment\.com/i,
  hubspot: /js\.hs-scripts|hubspot/i,
};

function inferIndustryFromName(name: string): string | null {
  const n = name.toLowerCase();
  if (/(logistic|transport|freight|cargo|shipping|port)/.test(n)) return "Logistique";
  if (/(bank|banque|finance|pay|fintech|insurance|assur)/.test(n)) return "Fintech";
  if (/(agro|agriculture|food|nourriture)/.test(n)) return "Agroalimentaire";
  if (/(retail|commerce|e-commerce|distribution)/.test(n)) return "Retail";
  if (/(tech|software|digital|data|cloud|platform|it)/.test(n)) return "Technologie";
  if (/(energy|energie|solaire|renouvelable)/.test(n)) return "Énergie";
  if (/(construction|immobilier|bati|real estate)/.test(n)) return "Construction";
  if (/(health|sante|medical|pharma|clinique)/.test(n)) return "Santé";
  if (/(education|formation|school|universite)/.test(n)) return "Éducation";
  if (/(telecom|mobile|connect)/.test(n)) return "Télécom";
  return null;
}

async function stepWebsite(domain: string) {
  const url = `https://${domain}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "SalesInsightBot/1.0 (+sales intelligence)" },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, note: `HTTP ${res.status}`, techStack: [] };

    const server = res.headers.get("server") ?? "";
    const poweredBy = res.headers.get("x-powered-by") ?? "";
    const html = (await res.text()).slice(0, 400_000);

    const techStack: string[] = [];
    for (const [name, re] of Object.entries(TECH_MARKERS)) {
      if (re.test(html) || re.test(server) || re.test(poweredBy)) {
        techStack.push(name);
      }
    }
    const title =
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;

    return {
      ok: true,
      note: title ?? "site accessible",
      techStack: [...new Set(techStack)],
      summary: title,
    };
  } catch {
    return { ok: false, note: "site inaccessible", techStack: [] };
  }
}

async function stepDns(domain: string) {
  try {
    const [mx, txt] = await Promise.all([
      dns.promises.resolveMx(domain).catch(() => []),
      dns.promises.resolveTxt(domain).catch(() => []),
    ]);
    if (mx.length === 0) return { ok: false, note: "aucun enregistrement MX" };
    const providers = mx.map((m) => m.exchange.toLowerCase());
    const hasGoogle = providers.some((p) => p.includes("google"));
    const hasO365 = providers.some((p) => p.includes("outlook") || p.includes("office365"));
    const hasZoho = providers.some((p) => p.includes("zoho"));
    const tech: string[] = [];
    if (hasGoogle) tech.push("google_workspace");
    if (hasO365) tech.push("microsoft_365");
    if (hasZoho) tech.push("zoho_mail");
    const spf = txt.some((r) => r.join(" ").toLowerCase().includes("spf"));
    return { ok: true, note: `MX: ${providers.slice(0, 2).join(", ")}`, techStack: tech, spf };
  } catch {
    return { ok: false, note: "lookup DNS impossible" };
  }
}

async function stepJobBoard(domain: string, name: string) {
  const candidates = [
    `https://${domain}/feed/`,
    `https://${domain}/feed`,
    `https://${domain}/rss`,
    `https://${domain}/blog/feed/`,
  ];
  for (const url of candidates) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const body = (await res.text()).slice(0, 200_000);
      const items = (body.match(/<item>/g) ?? []).length;
      if (items > 0) return { ok: true, note: `flux RSS (${items} entrées)` };
    } catch {
      /* étape suivante */
    }
  }
  return { ok: false, note: `aucun flux trouvé pour ${name}` };
}

async function stepPublicApi(domain: string) {
  if (!domain.endsWith(".fr")) {
    return { ok: false, note: "API publique non applicable (hors .fr)" };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(domain.replace(/\.fr$/, ""))}&per_page=1`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return { ok: false, note: `API HTTP ${res.status}` };
    const data = (await res.json()) as {
      results?: { nature_juridique?: string; tranche_effectif_salarie?: string }[];
    };
    const r = data.results?.[0];
    if (!r) return { ok: false, note: "aucun résultat" };
    return {
      ok: true,
      note: "données INSEE/recherche-entreprises",
      legalForm: r.nature_juridique,
      sizeBand: r.tranche_effectif_salarie,
    };
  } catch {
    return { ok: false, note: "API publique inaccessible" };
  }
}

function stepHeuristic(name: string, domain: string, existing: { industry?: string | null; techStack: string[] }) {
  const industry = inferIndustryFromName(name);
  const notes: string[] = [];
  if (industry && !existing.industry) notes.push(`secteur inféré (${industry})`);
  if (existing.techStack.length === 0) notes.push("stack technique inconnue");
  return {
    ok: notes.length > 0,
    note: notes.join(" ; ") || "rien à déduire",
    industry,
  };
}

export async function enrichCompany(companyId: string): Promise<EnrichmentResult> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
  });
  const domain = company.domain?.toLowerCase() || "";

  const steps: EnrichmentResult["steps"] = [];
  const techStack = new Set(company.techStack ?? []);
  let industry: string | undefined = company.industry ?? undefined;

  // 1. Site web (headers + HTML → technographie)
  const site = await stepWebsite(domain);
  site.techStack?.forEach((t) => techStack.add(t));
  steps.push({ kind: "website", ok: site.ok, note: site.note });
  await prisma.dataSource.create({
    data: { companyId, kind: "website", url: `https://${domain}`, payload: { ok: site.ok, note: site.note, tech: site.techStack ?? [] } },
  });

  // 2. DNS / en-têtes
  const dnsRes = await stepDns(domain);
  dnsRes.techStack?.forEach((t) => techStack.add(t));
  steps.push({ kind: "dns_headers", ok: dnsRes.ok, note: dnsRes.note });
  await prisma.dataSource.create({
    data: { companyId, kind: "dns", payload: { ok: dnsRes.ok, note: dnsRes.note, tech: dnsRes.techStack ?? [] } },
  });

  // 3. Job boards / flux RSS
  const jobs = await stepJobBoard(domain, company.name);
  steps.push({ kind: "job_board", ok: jobs.ok, note: jobs.note });
  await prisma.dataSource.create({
    data: { companyId, kind: "job_board", url: `https://${domain}/feed/`, payload: { ok: jobs.ok, note: jobs.note } },
  });

  // 4. API publiques
  const pub = await stepPublicApi(domain);
  steps.push({ kind: "public_api", ok: pub.ok, note: pub.note });
  await prisma.dataSource.create({
    data: { companyId, kind: "public_api", payload: { ok: pub.ok, note: pub.note } },
  });

  // 5. Heuristique (fallback hors-ligne)
  const heur = stepHeuristic(company.name, domain, { industry: industry ?? null, techStack: [...techStack] });
  if (heur.industry && !industry) industry = heur.industry;
  steps.push({ kind: "heuristic", ok: heur.ok, note: heur.note });
  await prisma.dataSource.create({
    data: { companyId, kind: "heuristic", payload: { note: heur.note } },
  });

  const result: EnrichmentResult = {
    industry,
    techStack: [...techStack],
    summary: site.summary ?? undefined,
    steps,
  };

  await prisma.company.update({
    where: { id: companyId },
    data: {
      industry: result.industry ?? company.industry,
      techStack: result.techStack,
      lastEnrichedAt: new Date(),
      raw: result as unknown as Prisma.InputJsonValue,
    },
  });

  return result;
}

export async function enrichLead(leadId: string): Promise<EnrichmentResult | null> {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { company: true },
  });
  if (!lead.company) return null;

  const result = await enrichCompany(lead.company.id);
  await prisma.lead.update({
    where: { id: leadId },
    data: { lastEnrichedAt: new Date() },
  });
  return result;
}
