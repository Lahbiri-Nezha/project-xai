import { headers } from "next/headers";
import { auth } from "./auth";
import { prisma } from "./prisma";

export async function requireSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function getOrganizationId() {
  const session = await requireSession();
  const activeId = session.session.activeOrganizationId;
  if (activeId) {
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: activeId,
        },
      },
      select: { organizationId: true },
    });
    if (membership) return membership.organizationId;
  }

  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  if (!membership) throw new Error("No active organization");
  return membership.organizationId;
}
