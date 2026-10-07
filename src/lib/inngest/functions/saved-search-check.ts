import { inngest } from "../client";
import { withMetrics } from "../observability";
import { prisma } from "@/lib/prisma";
import { searchCompanies, companyFiltersSchema } from "@/lib/trpc/routers/company";

export const savedSearchCheckFunction = inngest.createFunction(
  { id: "saved-search-check", triggers: [{ cron: "0 8 * * *" }] },
  async () =>
    withMetrics("saved-search-check", async () => {
      const searches = await prisma.savedSearch.findMany({
        where: { notifyFrequency: { in: ["daily", "weekly"] } },
        select: {
          id: true,
          organizationId: true,
          filtersJson: true,
          lastResultCount: true,
        },
      });

      const updated: { id: string; newCount: number }[] = [];
      for (const search of searches) {
        const parsed = companyFiltersSchema.safeParse(search.filtersJson);
        const filters = parsed.success ? parsed.data : {};
        const result = await searchCompanies({
          organizationId: search.organizationId,
          query: undefined,
          filters,
          limit: 1,
          offset: 0,
        });
        const current = result.total;
        const newSinceNotified = Math.max(0, current - search.lastResultCount);
        await prisma.savedSearch.update({
          where: { id: search.id },
          data: { lastResultCount: current, newSinceNotified },
        });
        if (newSinceNotified > 0) updated.push({ id: search.id, newCount: newSinceNotified });
      }

      return { checked: searches.length, withNewResults: updated.length };
    })
);
