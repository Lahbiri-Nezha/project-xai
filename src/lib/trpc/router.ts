import { router } from "./server";
import { leadRouter } from "./routers/lead";
import { companyRouter } from "./routers/company";
import { organizationRouter } from "./routers/organization";
import { copilotRouter } from "./routers/copilot";
import { billingRouter } from "./routers/billing";
import { listRouter } from "./routers/list";
import { savedSearchRouter } from "./routers/savedSearch";
import { sequenceRouter } from "./routers/sequence";
import { complianceRouter } from "./routers/compliance";

export const appRouter = router({
  lead: leadRouter,
  company: companyRouter,
  organization: organizationRouter,
  copilot: copilotRouter,
  billing: billingRouter,
  list: listRouter,
  savedSearch: savedSearchRouter,
  sequence: sequenceRouter,
  compliance: complianceRouter,
});

export type AppRouter = typeof appRouter;
