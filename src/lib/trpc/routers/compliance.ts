import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../server";
import {
  normalizeValue,
  complianceTypes,
  getComplianceBlock,
} from "@/lib/compliance";

export { normalizeValue, complianceTypes, getComplianceBlock };

export const complianceRouter = router({
  flags: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.complianceFlag.findMany({
      where: { organizationId: ctx.orgId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        value: z.string().min(1).max(500),
        type: z.enum(complianceTypes),
        contactId: z.string().optional(),
        source: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const normalized = normalizeValue(input.type, input.value);
      const existing = await ctx.prisma.complianceFlag.findFirst({
        where: {
          organizationId: ctx.orgId,
          type: input.type,
          value: normalized,
        },
        select: { id: true },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ce flag de conformité existe déjà.",
        });
      }
      return ctx.prisma.complianceFlag.create({
        data: {
          organizationId: ctx.orgId,
          contactId: input.contactId,
          value: normalized,
          type: input.type,
          source: input.source ?? "manual",
        },
      });
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const res = await ctx.prisma.complianceFlag.deleteMany({
        where: { id: input.id, organizationId: ctx.orgId },
      });
      if (res.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Flag not found" });
      }
      return { ok: true };
    }),

  check: protectedProcedure
    .input(
      z.object({
        email: z.string().optional(),
        phone: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const or: { value: string }[] = [];
      if (input.email) or.push({ value: input.email.toLowerCase() });
      if (input.phone) or.push({ value: input.phone.replace(/[^+\d]/g, "") });
      if (or.length === 0) return [];
      return ctx.prisma.complianceFlag.findMany({
        where: { organizationId: ctx.orgId, OR: or },
      });
    }),

  accessLogs: protectedProcedure
    .input(
      z.object({
        entityType: z.string().optional(),
        entityId: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.accessLog.findMany({
        where: {
          organizationId: ctx.orgId,
          ...(input.entityType ? { entityType: input.entityType } : {}),
          ...(input.entityId ? { entityId: input.entityId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),
});
