"use server";

import { prisma } from "@/lib/prisma";
import { getOrganizationId } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import { inngest } from "@/lib/inngest/client";

export async function scoreLeadsManually() {
  const orgId = await getOrganizationId();
  const leads = await prisma.lead.findMany({
    where: { organizationId: orgId, status: "NEW" },
    select: { id: true },
  });

  await inngest.send({
    name: "leads.created",
    data: { leadIds: leads.map((l: { id: string }) => l.id) },
  });

  revalidatePath("/dashboard/leads");
  return { scored: leads.length };
}
