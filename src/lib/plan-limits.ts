import { prisma } from "./prisma";
import { PLANS } from "./stripe";

export async function checkLeadQuota(orgId: string) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
  });
  const plan = PLANS[org.plan as keyof typeof PLANS] ?? PLANS.FREE;
  if (plan.leadsPerMonth === -1) return { allowed: true, remaining: -1 };

  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  );
  const count = await prisma.lead.count({
    where: {
      organizationId: orgId,
      createdAt: { gte: startOfMonth },
    },
  });
  return {
    allowed: count < plan.leadsPerMonth,
    remaining: plan.leadsPerMonth - count,
  };
}
