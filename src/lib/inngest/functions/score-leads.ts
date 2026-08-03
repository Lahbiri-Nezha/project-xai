import { inngest } from "../client";
import { withMetrics } from "../observability";
import { scoreLead } from "@/lib/ai/scoring";

export const scoreLeadsFunction = inngest.createFunction(
  { id: "score-leads", triggers: [{ event: "leads.created" }] },
  async ({ event }) => {
    const { leadIds } = event.data;
    await withMetrics("score-leads", async () => {
      for (const id of leadIds) {
        await scoreLead(id);
      }
    }, { count: leadIds.length });
  }
);
