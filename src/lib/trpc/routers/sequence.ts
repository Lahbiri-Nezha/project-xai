import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../server";
import { getComplianceBlock } from "@/lib/compliance";

const stepSchema = z.object({
  channel: z.enum(["EMAIL", "CALL", "TASK"]),
  delayDays: z.number().int().min(0).max(90).default(1),
  template: z.string().max(1000).optional(),
});

export const sequenceRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const sequences = await ctx.prisma.sequence.findMany({
      where: { organizationId: ctx.orgId },
      orderBy: { updatedAt: "desc" },
      include: {
        steps: { orderBy: { order: "asc" } },
        _count: { select: { enrollments: true } },
      },
    });
    return sequences;
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const sequence = await ctx.prisma.sequence.findFirst({
        where: { id: input.id, organizationId: ctx.orgId },
        include: {
          steps: { orderBy: { order: "asc" } },
          enrollments: {
            include: {
              lead: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  score: true,
                  intent: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
          },
        },
      });
      if (!sequence) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sequence not found" });
      }
      return sequence;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        steps: z.array(stepSchema).min(1).max(12),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.sequence.create({
        data: {
          organizationId: ctx.orgId,
          name: input.name,
          steps: {
            create: input.steps.map((s, i) => ({
              order: i + 1,
              channel: s.channel,
              delayDays: s.delayDays,
              template: s.template,
            })),
          },
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.sequence.findFirst({
        where: { id: input.id, organizationId: ctx.orgId },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sequence not found" });
      }
      return ctx.prisma.sequence.update({
        where: { id: input.id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.active != null ? { active: input.active } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const res = await ctx.prisma.sequence.deleteMany({
        where: { id: input.id, organizationId: ctx.orgId },
      });
      if (res.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sequence not found" });
      }
      return { ok: true };
    }),

  enroll: protectedProcedure
    .input(
      z.object({
        sequenceId: z.string(),
        leadIds: z.array(z.string()).min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sequence = await ctx.prisma.sequence.findFirst({
        where: { id: input.sequenceId, organizationId: ctx.orgId },
        include: { steps: { orderBy: { order: "asc" } } },
      });
      if (!sequence) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sequence not found" });
      }

      const leads = await ctx.prisma.lead.findMany({
        where: { id: { in: input.leadIds }, organizationId: ctx.orgId },
        select: { id: true, email: true, phone: true, firstName: true, lastName: true },
      });

      const results: {
        leadId: string;
        name: string;
        status: "enrolled" | "blocked" | "duplicate";
        reason?: string;
      }[] = [];

      for (const lead of leads) {
        const existing = await ctx.prisma.sequenceEnrollment.findFirst({
          where: { sequenceId: sequence.id, leadId: lead.id },
          select: { id: true },
        });
        if (existing) {
          results.push({
            leadId: lead.id,
            name: `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim(),
            status: "duplicate",
          });
          continue;
        }

        const compliance = await getComplianceBlock(ctx.prisma, ctx.orgId, lead);
        if (compliance.blocked) {
          results.push({
            leadId: lead.id,
            name: `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim(),
            status: "blocked",
            reason: compliance.reason,
          });
          continue;
        }

        const firstStep = sequence.steps[0];
        await ctx.prisma.sequenceEnrollment.create({
          data: {
            sequenceId: sequence.id,
            leadId: lead.id,
            status: "ACTIVE",
            stepIndex: 0,
            nextStepAt: firstStep
              ? new Date(Date.now() + firstStep.delayDays * 86400000)
              : new Date(),
          },
        });
        results.push({
          leadId: lead.id,
          name: `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim(),
          status: "enrolled",
        });
      }

      const blocked = results.filter((r) => r.status === "blocked").length;
      const enrolled = results.filter((r) => r.status === "enrolled").length;
      return { results, summary: { enrolled, blocked } };
    }),

  getTasks: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const enrollments = await ctx.prisma.sequenceEnrollment.findMany({
      where: {
        sequence: { organizationId: ctx.orgId },
        status: { in: ["PENDING", "ACTIVE"] },
        nextStepAt: { lte: now },
      },
      include: {
        sequence: {
          select: { id: true, name: true, steps: { orderBy: { order: "asc" } } },
        },
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            score: true,
            intent: true,
          },
        },
      },
      orderBy: { nextStepAt: "asc" },
      take: 50,
    });
    return enrollments;
  }),

  advanceTask: protectedProcedure
    .input(z.object({ enrollmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const enrollment = await ctx.prisma.sequenceEnrollment.findFirst({
        where: {
          id: input.enrollmentId,
          sequence: { organizationId: ctx.orgId },
        },
        include: {
          sequence: { select: { steps: { orderBy: { order: "asc" } } } },
        },
      });
      if (!enrollment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Enrollment not found" });
      }

      const steps = enrollment.sequence.steps;
      const nextIndex = enrollment.stepIndex + 1;

      if (nextIndex >= steps.length) {
        return ctx.prisma.sequenceEnrollment.update({
          where: { id: enrollment.id },
          data: { status: "DONE", nextStepAt: null },
        });
      }

      const nextStep = steps[nextIndex];
      return ctx.prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          stepIndex: nextIndex,
          status: "ACTIVE",
          nextStepAt: new Date(Date.now() + nextStep.delayDays * 86400000),
        },
      });
    }),
});
