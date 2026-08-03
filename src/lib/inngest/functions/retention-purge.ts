import { inngest } from "../client";
import { withMetrics } from "../observability";
import { prisma } from "@/lib/prisma";

const RETENTION_MONTHS = Number(process.env.RETENTION_MONTHS ?? 36);
const RETENTION_MS = RETENTION_MONTHS * 30 * 24 * 60 * 60 * 1000;

export const retentionPurgeFunction = inngest.createFunction(
  { id: "retention-purge", triggers: [{ cron: "0 3 * * *" }] },
  async () =>
    withMetrics("retention-purge", async () => {
      const cutoff = new Date(Date.now() - RETENTION_MS);

      const orgs = await prisma.organization.findMany({
        select: { id: true },
      });

      let totalDeleted = 0;
      const purged: { organizationId: string; count: number }[] = [];

      for (const org of orgs) {
        const res = await prisma.lead.deleteMany({
          where: {
            organizationId: org.id,
            createdAt: { lt: cutoff },
            status: { not: "CONVERTED" },
          },
        });
        if (res.count > 0) {
          totalDeleted += res.count;
          purged.push({ organizationId: org.id, count: res.count });
          await prisma.accessLog.create({
            data: {
              organizationId: org.id,
              userId: "system",
              action: "PURGE",
              entityType: "LEAD_BATCH",
              entityId: `${res.count}`,
            },
          });
        }
      }

      return { cutoff, retentionMonths: RETENTION_MONTHS, totalDeleted, purged };
    })
);
