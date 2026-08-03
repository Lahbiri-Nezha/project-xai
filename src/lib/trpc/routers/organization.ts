import { z } from "zod";
import { router, protectedProcedure } from "../server";

export const organizationRouter = router({
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.organization.findUnique({
      where: { id: ctx.orgId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
        },
      },
    });
  }),

  update: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.organization.update({
        where: { id: ctx.orgId },
        data: { name: input.name },
      });
    }),

  listMembers: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.organizationMembership.findMany({
      where: { organizationId: ctx.orgId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    });
  }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const d60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [leadCount, companyCount, hotLeads, warmLeads, coldLeads, verified, avg, last30, prev30] =
      await Promise.all([
        ctx.prisma.lead.count({ where: { organizationId: ctx.orgId } }),
        ctx.prisma.company.findMany({
          where: { leads: { some: { organizationId: ctx.orgId } } },
          distinct: ["id"],
        }),
        ctx.prisma.lead.count({
          where: { organizationId: ctx.orgId, intent: "HOT" },
        }),
        ctx.prisma.lead.count({
          where: { organizationId: ctx.orgId, intent: "WARM" },
        }),
        ctx.prisma.lead.count({
          where: { organizationId: ctx.orgId, intent: "COLD" },
        }),
        ctx.prisma.lead.count({
          where: { organizationId: ctx.orgId, verification: "VERIFIED" },
        }),
        ctx.prisma.lead.aggregate({
          where: { organizationId: ctx.orgId },
          _avg: { score: true },
        }),
        ctx.prisma.lead.count({
          where: { organizationId: ctx.orgId, createdAt: { gte: d30 } },
        }),
        ctx.prisma.lead.count({
          where: { organizationId: ctx.orgId, createdAt: { gte: d60, lt: d30 } },
        }),
      ]);

    return {
      totalLeads: leadCount,
      totalCompanies: companyCount.length,
      hotLeads,
      warmLeads,
      coldLeads,
      verifiedLeads: verified,
      avgScore: Math.round(avg._avg.score ?? 0),
      newLeadsLast30d: last30,
      newLeadsPrev30d: prev30,
    };
  }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const [org, memberships] = await Promise.all([
      ctx.prisma.organization.findUnique({
        where: { id: ctx.orgId },
        select: { name: true },
      }),
      ctx.prisma.organizationMembership.findMany({
        where: { userId: ctx.session.user.id },
        select: { organizationId: true },
      }),
    ]);
    return {
      orgName: org?.name ?? null,
      userName: ctx.session.user.name ?? ctx.session.user.email?.split("@")[0] ?? null,
      userEmail: ctx.session.user.email ?? null,
      userImage: ctx.session.user.image ?? null,
      orgCount: memberships.length,
    };
  }),
});
