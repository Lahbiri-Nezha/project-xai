import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../server";
import { searchCompanies, companyFiltersSchema } from "./company";

export const savedSearchRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.savedSearch.findMany({
      where: { organizationId: ctx.orgId },
      orderBy: { updatedAt: "desc" },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        filters: companyFiltersSchema,
        notifyFrequency: z.enum(["daily", "weekly", "never"]).default("daily"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const search = await ctx.prisma.savedSearch.create({
        data: {
          organizationId: ctx.orgId,
          userId: ctx.session.user.id,
          name: input.name,
          filtersJson: input.filters,
          notifyFrequency: input.notifyFrequency,
          lastResultCount: 0,
          newSinceNotified: 0,
        },
      });
      return search;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        filters: companyFiltersSchema.optional(),
        notifyFrequency: z.enum(["daily", "weekly", "never"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.savedSearch.findFirst({
        where: { id: input.id, organizationId: ctx.orgId },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Saved search not found" });
      }
      return ctx.prisma.savedSearch.update({
        where: { id: input.id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.filters ? { filtersJson: input.filters } : {}),
          ...(input.notifyFrequency ? { notifyFrequency: input.notifyFrequency } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const res = await ctx.prisma.savedSearch.deleteMany({
        where: { id: input.id, organizationId: ctx.orgId },
      });
      if (res.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Saved search not found" });
      }
      return { ok: true };
    }),

  run: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const search = await ctx.prisma.savedSearch.findFirst({
        where: { id: input.id, organizationId: ctx.orgId },
      });
      if (!search) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Saved search not found" });
      }
      const parsed = companyFiltersSchema.safeParse(search.filtersJson);
      const filters = parsed.success ? parsed.data : {};
      const result = await searchCompanies({
        query: undefined,
        filters,
        limit: 50,
        offset: 0,
      });
      return { total: result.total, companies: result.companies.slice(0, 10) };
    }),

  acknowledge: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const search = await ctx.prisma.savedSearch.findFirst({
        where: { id: input.id, organizationId: ctx.orgId },
        select: { id: true, lastResultCount: true },
      });
      if (!search) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Saved search not found" });
      }
      return ctx.prisma.savedSearch.update({
        where: { id: input.id },
        data: { newSinceNotified: 0 },
      });
    }),
});
