import { inngest } from "../client";
import { withMetrics } from "../observability";
import { enrichCompany } from "@/lib/ai/enrichment";

export const enrichCompanyFunction = inngest.createFunction(
  { id: "enrich-company", triggers: [{ event: "companies.created" }] },
  async ({ event }) => {
    const { companyId } = event.data;
    await withMetrics("enrich-company", () => enrichCompany(companyId), { companyId });
  }
);
