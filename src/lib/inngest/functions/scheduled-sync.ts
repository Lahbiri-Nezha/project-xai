import { inngest } from "../client";
import { withMetrics } from "../observability";
import { prisma } from "@/lib/prisma";
import { scoreLead } from "@/lib/ai/scoring";
import { enrichCompany } from "@/lib/ai/enrichment";

export const scheduledSyncFunction = inngest.createFunction(
  { id: "scheduled-sync", triggers: [{ cron: "0 6 * * *" }] },
  async () =>
    withMetrics("scheduled-sync", async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [staleLeads, staleCompanies] = await Promise.all([
        prisma.lead.findMany({
          where: {
            updatedAt: { lt: thirtyDaysAgo },
            status: { notIn: ["CONVERTED", "LOST"] },
          },
          take: 50,
        }),
        prisma.company.findMany({
          where: {
            OR: [{ lastEnrichedAt: { lt: thirtyDaysAgo } }, { lastEnrichedAt: null }],
          },
          take: 50,
        }),
      ]);

      let scored = 0;
      let enriched = 0;
      let errors = 0;
      for (const lead of staleLeads) {
        await scoreLead(lead.id).catch(() => {
          errors += 1;
        });
        scored += 1;
      }
      for (const company of staleCompanies) {
        await enrichCompany(company.id).catch(() => {
          errors += 1;
        });
        enriched += 1;
      }

      return { scored, enriched, errors };
    })
);
