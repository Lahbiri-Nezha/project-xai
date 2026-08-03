import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../server";
import { uploadExportToStorage } from "@/lib/export-storage";

export const listRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const lists = await ctx.prisma.list.findMany({
      where: { organizationId: ctx.orgId },
      orderBy: { updatedAt: "desc" },
      include: {
        items: {
          include: {
            lead: { select: { id: true, firstName: true, lastName: true, email: true, score: true, intent: true } },
            company: { select: { id: true, name: true } },
          },
        },
      },
    });
    return lists;
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const list = await ctx.prisma.list.findFirst({
        where: { id: input.id, organizationId: ctx.orgId },
        include: {
          items: {
            include: {
              lead: { select: { id: true, firstName: true, lastName: true, email: true, title: true, score: true, intent: true, status: true } },
              company: { select: { id: true, name: true, industry: true, headquartersCity: true } },
            },
          },
        },
      });
      if (!list) throw new TRPCError({ code: "NOT_FOUND", message: "List not found" });
      return list;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        type: z.enum(["LEADS", "ACCOUNTS"]).default("LEADS"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.list.create({
        data: {
          organizationId: ctx.orgId,
          ownerId: ctx.session.user.id,
          name: input.name,
          type: input.type,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const res = await ctx.prisma.list.deleteMany({
        where: { id: input.id, organizationId: ctx.orgId },
      });
      if (res.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "List not found" });
      }
      return { ok: true };
    }),

  addItems: protectedProcedure
    .input(
      z.object({
        listId: z.string(),
        leadIds: z.array(z.string()).optional(),
        companyIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const list = await ctx.prisma.list.findFirst({
        where: { id: input.listId, organizationId: ctx.orgId },
        select: { id: true },
      });
      if (!list) throw new TRPCError({ code: "NOT_FOUND", message: "List not found" });

      const { count } = await ctx.prisma.listItem.createMany({
        data: [
          ...(input.leadIds ?? []).map((leadId) => ({
            listId: list.id,
            leadId,
          })),
          ...(input.companyIds ?? []).map((companyId) => ({
            listId: list.id,
            companyId,
          })),
        ],
        skipDuplicates: true,
      });
      return { added: count };
    }),

  removeItem: protectedProcedure
    .input(z.object({ listId: z.string(), itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const list = await ctx.prisma.list.findFirst({
        where: { id: input.listId, organizationId: ctx.orgId },
        select: { id: true },
      });
      if (!list) throw new TRPCError({ code: "NOT_FOUND", message: "List not found" });
      const res = await ctx.prisma.listItem.deleteMany({
        where: { id: input.itemId, listId: list.id },
      });
      return { removed: res.count };
    }),

  exportCsv: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const list = await ctx.prisma.list.findFirst({
        where: { id: input.id, organizationId: ctx.orgId },
        include: {
          items: {
            include: {
              lead: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, title: true, score: true, intent: true, verification: true } },
              company: { select: { id: true, name: true, industry: true, headquartersCity: true, headquartersCountry: true, techStack: true } },
            },
          },
        },
      });
      if (!list) throw new TRPCError({ code: "NOT_FOUND", message: "List not found" });

      let csv: string;
      let exported: number;
      let blocked = 0;

      if (list.type === "LEADS") {
        const flags = await ctx.prisma.complianceFlag.findMany({
          where: { organizationId: ctx.orgId, type: { in: ["OPT_OUT", "DO_NOT_CALL", "SUPPRESSED"] } },
          select: { value: true, contactId: true },
        });
        const blockedValues = new Set(flags.map((f) => f.value));
        const blockedContactIds = new Set(flags.filter((f) => f.contactId).map((f) => f.contactId as string));

        const leads = list.items.flatMap((item) => (item.lead ? [item.lead] : []));
        const rows = leads.filter(
          (l) =>
            !blockedContactIds.has(l.id) &&
            !(l.email && blockedValues.has(l.email.toLowerCase())) &&
            !(l.phone && blockedValues.has(l.phone.replace(/[^+\d]/g, "")))
        );
        blocked = leads.length - rows.length;

        const header = "first_name,last_name,email,phone,title,score,intent,verification";
        csv = [
          header,
          ...rows.map((l) =>
            [
              `"${(l.firstName ?? "").replace(/"/g, '""')}"`,
              `"${(l.lastName ?? "").replace(/"/g, '""')}"`,
              `"${(l.email ?? "").replace(/"/g, '""')}"`,
              `"${(l.phone ?? "").replace(/"/g, '""')}"`,
              `"${(l.title ?? "").replace(/"/g, '""')}"`,
              Math.round(l.score),
              l.intent,
              l.verification,
            ].join(",")
          ),
        ].join("\n");
        exported = rows.length;
      } else {
        const companies = list.items.flatMap((item) => (item.company ? [item.company] : []));
        const header = "name,industry,city,country,tech_stack";
        csv = [
          header,
          ...companies.map((c) =>
            [
              `"${(c.name ?? "").replace(/"/g, '""')}"`,
              `"${(c.industry ?? "").replace(/"/g, '""')}"`,
              `"${(c.headquartersCity ?? "").replace(/"/g, '""')}"`,
              `"${(c.headquartersCountry ?? "").replace(/"/g, '""')}"`,
              `"${c.techStack.join(";")}"`,
            ].join(",")
          ),
        ].join("\n");
        exported = companies.length;
      }

      await ctx.prisma.accessLog.create({
        data: {
          organizationId: ctx.orgId,
          userId: ctx.session.user.id,
          action: "EXPORT",
          entityType: "LIST",
          entityId: list.id,
        },
      });

      const fileName = `${list.name.replace(/[^a-z0-9-_]/gi, "_")}.csv`;
      const url = await uploadExportToStorage(fileName, csv);

      return { url, csv: url ? null : csv, listName: list.name, exported, blocked };
    }),
});
