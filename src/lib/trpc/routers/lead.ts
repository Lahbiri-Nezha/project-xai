import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, expensiveProcedure } from "../server";
import { checkLeadQuota } from "@/lib/plan-limits";
import { scoreLead } from "@/lib/ai/scoring";
import { sendEvent } from "@/lib/inngest/client";
import { buildLeadWhere } from "@/lib/lead-filter";
import { uploadExportToStorage } from "@/lib/export-storage";

const verificationValues = ["UNVERIFIED", "PENDING", "VERIFIED", "INVALID"] as const;

const listInputSchema = z.object({
  intent: z.enum(["COLD", "WARM", "HOT"]).optional(),
  status: z
    .enum([
      "NEW",
      "CONTACTED",
      "QUALIFIED",
      "UNQUALIFIED",
      "CONVERTED",
      "LOST",
    ])
    .optional(),
  title: z.string().optional(),
  companyName: z.string().optional(),
  companyId: z.string().optional(),
  city: z.string().optional(),
  industry: z.string().optional(),
  techStack: z.array(z.string()).optional(),
  hasEmail: z.boolean().optional(),
  hasPhone: z.boolean().optional(),
  verification: z.enum(verificationValues).optional(),
  scoreMin: z.number().min(0).max(100).optional(),
  scoreMax: z.number().min(0).max(100).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export const leadRouter = router({
  list: protectedProcedure
    .input(listInputSchema)
    .query(async ({ ctx, input }) => {
      const where = buildLeadWhere({ ...input, organizationId: ctx.orgId });

      const [leads, total] = await Promise.all([
        ctx.prisma.lead.findMany({
          where,
          include: { company: true, signals: true },
          orderBy: { score: "desc" },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.lead.count({ where }),
      ]);

      return { leads, total };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const lead = await ctx.prisma.lead.findFirst({
        where: { id: input.id, organizationId: ctx.orgId },
        include: {
          company: { include: { buyingSignals: true } },
          signals: true,
          activities: true,
          dataSources: true,
          enrollments: { include: { sequence: true } },
        },
      });
      if (!lead) throw new Error("Lead not found");
      return lead;
    }),

  rescore: expensiveProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.prisma.lead.findFirst({
        where: { id: input.id, organizationId: ctx.orgId },
        select: { id: true },
      });
      if (!lead) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
      }
      return scoreLead(input.id);
    }),

  setVerification: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        verification: z.enum(["VERIFIED", "INVALID", "UNVERIFIED"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.prisma.lead.findFirst({
        where: { id: input.id, organizationId: ctx.orgId },
        select: { id: true },
      });
      if (!lead) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
      }
      const updated = await ctx.prisma.lead.update({
        where: { id: input.id },
        data: { verification: input.verification },
      });

      await ctx.prisma.accessLog.create({
        data: {
          organizationId: ctx.orgId,
          userId: ctx.session.user.id,
          action: input.verification === "VERIFIED" ? "VERIFY" : input.verification === "INVALID" ? "MARK_INVALID" : "RESET_VERIFICATION",
          entityType: "LEAD",
          entityId: input.id,
        },
      });
      await ctx.prisma.activity.create({
        data: {
          leadId: input.id,
          type: input.verification === "VERIFIED" ? "VERIFY" : input.verification === "INVALID" ? "MARK_INVALID" : "RESET_VERIFICATION",
          metadata: { by: ctx.session.user.id },
        },
      });
      return updated;
    }),

  setStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum([
          "NEW",
          "CONTACTED",
          "QUALIFIED",
          "UNQUALIFIED",
          "CONVERTED",
          "LOST",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.prisma.lead.findFirst({
        where: { id: input.id, organizationId: ctx.orgId },
        select: { id: true },
      });
      if (!lead) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
      }
      const updated = await ctx.prisma.lead.update({
        where: { id: input.id },
        data: { status: input.status },
      });

      await ctx.prisma.activity.create({
        data: {
          leadId: input.id,
          type: `STATUS_${input.status}`,
          metadata: { by: ctx.session.user.id },
        },
      });
      return updated;
    }),

  exportCsv: protectedProcedure
    .input(listInputSchema.omit({ limit: true, offset: true }))
    .query(async ({ ctx, input }) => {
      const where = buildLeadWhere({ ...input, organizationId: ctx.orgId });
      const leads = await ctx.prisma.lead.findMany({
        where,
        include: { company: true },
        orderBy: { score: "desc" },
        take: 500,
      });

      const flags = await ctx.prisma.complianceFlag.findMany({
        where: {
          organizationId: ctx.orgId,
          type: { in: ["OPT_OUT", "DO_NOT_CALL", "SUPPRESSED"] },
        },
        select: { value: true, contactId: true },
      });
      const blockedValues = new Set(flags.map((f) => f.value));
      const blockedContactIds = new Set(
        flags.filter((f) => f.contactId).map((f) => f.contactId as string)
      );

      const exported = leads.filter(
        (l) =>
          !blockedContactIds.has(l.id) &&
          !(l.email && blockedValues.has(l.email.toLowerCase())) &&
          !(l.phone && blockedValues.has(l.phone.replace(/[^+\d]/g, "")))
      );

      if (exported.length > 0) {
        await ctx.prisma.accessLog.create({
          data: {
            organizationId: ctx.orgId,
            userId: ctx.session.user.id,
            action: "EXPORT",
            entityType: "LEAD_BATCH",
            entityId: `${exported.length}`,
          },
        });
      }

      const header =
        "first_name,last_name,email,phone,title,company,industry,city,country,score,intent,verification";
      const rows = exported.map((l) =>
        [
          `"${(l.firstName ?? "").replace(/"/g, '""')}"`,
          `"${(l.lastName ?? "").replace(/"/g, '""')}"`,
          `"${(l.email ?? "").replace(/"/g, '""')}"`,
          `"${(l.phone ?? "").replace(/"/g, '""')}"`,
          `"${(l.title ?? "").replace(/"/g, '""')}"`,
          `"${(l.company?.name ?? "").replace(/"/g, '""')}"`,
          `"${(l.company?.industry ?? "").replace(/"/g, '""')}"`,
          `"${(l.company?.headquartersCity ?? "").replace(/"/g, '""')}"`,
          `"${(l.company?.headquartersCountry ?? "").replace(/"/g, '""')}"`,
          Math.round(l.score),
          l.intent,
          l.verification,
        ].join(",")
      );

      const csv = [header, ...rows].join("\n");
      const url = await uploadExportToStorage("leads.csv", csv);

      return {
        url,
        csv: url ? null : csv,
        total: leads.length,
        exported: exported.length,
        blocked: leads.length - exported.length,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        title: z.string().optional(),
        companyName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const quota = await checkLeadQuota(ctx.orgId);
      if (!quota.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Quota de leads atteint pour ce plan.",
        });
      }

      let companyId: string | undefined;
      if (input.companyName) {
        const existing = await ctx.prisma.company.findFirst({
          where: {
            organizationId: ctx.orgId,
            name: { contains: input.companyName, mode: "insensitive" },
          },
        });
        const company = existing ?? await ctx.prisma.company.create({
          data: {
            organizationId: ctx.orgId,
            name: input.companyName,
            domain: input.companyName.toLowerCase(),
          },
        });
        companyId = company.id;
      }

      const created = await ctx.prisma.lead.create({
        data: {
          organizationId: ctx.orgId,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          title: input.title,
          companyId,
        },
        include: { company: true, signals: true },
      });

      await sendEvent(
        "leads.created",
        { leadIds: [created.id] },
        async () => {
          await scoreLead(created.id);
        }
      );
      if (companyId) {
        await sendEvent("companies.created", { companyId });
      }

      return created;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.lead.deleteMany({
        where: { id: input.id, organizationId: ctx.orgId },
      });
    }),
});
