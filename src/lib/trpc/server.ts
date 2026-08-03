import { initTRPC, TRPCError } from "@trpc/server";
import { prisma } from "@/lib/prisma";
import { requireSession, getOrganizationId } from "@/lib/auth-utils";
import { getGeneralRatelimit, getExpensiveRatelimit } from "@/lib/rate-limit";

export async function createTRPCContext() {
  return { prisma, requireSession, getOrganizationId };
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof Error ? error.cause.message : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

async function resolveOrgPlan(orgId: string): Promise<string> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true },
    });
    return org?.plan ?? "FREE";
  } catch {
    return "FREE";
  }
}

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const session = await ctx.requireSession();
  const orgId = await ctx.getOrganizationId();
  const plan = await resolveOrgPlan(orgId);

  try {
    const limiter = getGeneralRatelimit(plan as "FREE" | "STARTER" | "PRO" | "ENTERPRISE");
    if (limiter) {
      const { success } = await limiter.limit(session.user.id);
      if (!success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Rate limit exceeded. Please try again later.",
        });
      }
    }
  } catch (err) {
    if (err instanceof TRPCError) throw err;
  }

  return next({
    ctx: {
      ...ctx,
      session,
      orgId,
      plan,
    },
  });
});

export const expensiveProcedure = t.procedure.use(async ({ ctx, next }) => {
  const session = await ctx.requireSession();
  const orgId = await ctx.getOrganizationId();
  const plan = await resolveOrgPlan(orgId);

  try {
    const limiter = getExpensiveRatelimit(plan as "FREE" | "STARTER" | "PRO" | "ENTERPRISE");
    if (limiter) {
      const { success } = await limiter.limit(session.user.id);
      if (!success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Quota IA atteint. Réessayez plus tard ou passez à un plan supérieur.",
        });
      }
    }
  } catch (err) {
    if (err instanceof TRPCError) throw err;
  }

  return next({
    ctx: {
      ...ctx,
      session,
      orgId,
      plan,
    },
  });
});
