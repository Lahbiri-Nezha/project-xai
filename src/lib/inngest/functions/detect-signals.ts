import { inngest } from "../client";
import { withMetrics } from "../observability";
import { prisma } from "@/lib/prisma";
import { scoreLead } from "@/lib/ai/scoring";

const KEYWORDS: { type: "HIRING" | "FUNDING" | "NEWS" | "ORG_CHANGE"; patterns: RegExp[] }[] = [
  {
    type: "HIRING",
    patterns: [
      /embauche/i,
      /recrute/i,
      /hiring/i,
      /\boffres d'emploi/i,
      /\bposte à pourvoir/i,
      /\bcarr?ieres/i,
      /talent/i,
      /careers/i,
      /jobs/i,
    ],
  },
  {
    type: "FUNDING",
    patterns: [
      /levée de fonds/i,
      /\blevee/i,
      /\bfunding/i,
      /\bsérie\s+[ab]/i,
      /\bserie\s+[ab]/i,
      /investisseur/i,
      /financement/i,
      /seed round/i,
    ],
  },
  {
    type: "NEWS",
    patterns: [
      /partenariat/i,
      /partnership/i,
      /expansion/i,
      /\blancement/i,
      /\blaunch/i,
      /acquisition/i,
      /croissance/i,
      /growth/i,
      /nouvelle/i,
    ],
  },
];

const FEED_CANDIDATES = ["/feed/", "/feed", "/rss", "/blog/feed/", "/actualites/feed"];

async function detectCompanySignals(company: {
  id: string;
  name: string;
  domain: string | null;
}) {
  if (!company.domain) return { companyId: company.id, created: 0 };

  const detected: { type: "HIRING" | "FUNDING" | "NEWS" | "ORG_CHANGE"; intensity: number }[] = [];

  for (const path of FEED_CANDIDATES) {
    const url = `https://${company.domain}${path}`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const body = (await res.text()).slice(0, 400_000);
      for (const group of KEYWORDS) {
        const hits = group.patterns.filter((re) => re.test(body)).length;
        if (hits > 0) {
          detected.push({ type: group.type, intensity: Math.min(5, hits) });
        }
      }
      break;
    } catch {
      /* essayer le flux suivant */
    }
  }

  let created = 0;
  for (const sig of detected) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const existing = await prisma.buyingSignal.findFirst({
      where: {
        companyId: company.id,
        type: sig.type,
        detectedAt: { gte: weekAgo },
      },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.buyingSignal.create({
      data: {
        companyId: company.id,
        type: sig.type,
        intensity: sig.intensity,
        source: `rss:${company.domain}`,
        detectedAt: new Date(),
      },
    });
    created += 1;

    const leads = await prisma.lead.findMany({
      where: { companyId: company.id },
      select: { id: true },
    });
    for (const lead of leads) {
      await prisma.signal.create({
        data: {
          leadId: lead.id,
          type: sig.type,
          value: sig.type,
          weight: sig.intensity,
          source: `rss:${company.domain}`,
        },
      });
      await scoreLead(lead.id).catch(() => {});
    }
  }

  return { companyId: company.id, created };
}

export const detectSignalsFunction = inngest.createFunction(
  {
    id: "detect-signals",
    triggers: [{ event: "signal.detect" }, { cron: "0 9 * * *" }],
  },
  async ({ step }) => {
    return withMetrics("detect-signals", async () => {
      const companies = await prisma.company.findMany({
        where: { domain: { not: null } },
        select: { id: true, name: true, domain: true },
        take: 100,
      });

      const results: { companyId: string; created: number }[] = [];
      for (const company of companies) {
        const res = await step.run(`detect-${company.id}`, () =>
          detectCompanySignals(company)
        );
        if (res.created > 0) results.push(res);
      }

      return {
        scanned: companies.length,
        companiesWithNewSignals: results.length,
        created: results.reduce((acc, r) => acc + r.created, 0),
      };
    });
  }
);
