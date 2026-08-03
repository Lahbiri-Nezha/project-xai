import { z } from "zod";
import { router, protectedProcedure } from "../server";
import { PLANS, type PlanKey } from "@/lib/stripe";
import { getStripe } from "@/lib/stripe";

export const billingRouter = router({
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const org = await ctx.prisma.organization.findUnique({
      where: { id: ctx.orgId },
      select: { plan: true, stripeCustomerId: true, stripeSubscriptionId: true },
    });

    const planKey = org?.plan as PlanKey;
    const plan = PLANS[planKey] ?? PLANS.FREE;

    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );
    const leadsUsed = await ctx.prisma.lead.count({
      where: { organizationId: ctx.orgId, createdAt: { gte: startOfMonth } },
    });

    return {
      plan: planKey,
      planName: plan.name,
      leadsPerMonth: plan.leadsPerMonth,
      leadsUsed,
      hasStripe: !!org?.stripeCustomerId,
    };
  }),

  createCheckout: protectedProcedure
    .input(z.object({ plan: z.enum(["STARTER", "PRO"]) }))
    .mutation(async ({ ctx, input }) => {
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("Le paiement n'est pas encore configuré sur cet environnement.");
      }

      const priceId = PLANS[input.plan].priceId;
      if (!priceId) throw new Error("Invalid plan");

      const stripe = getStripe();
      const org = await ctx.prisma.organization.findUnique({
        where: { id: ctx.orgId },
      });

      let customerId = org?.stripeCustomerId;

      if (!customerId) {
        const customer = await stripe.customers.create({
          name: org?.name,
          metadata: { orgId: ctx.orgId },
        });
        customerId = customer.id;
        await ctx.prisma.organization.update({
          where: { id: ctx.orgId },
          data: { stripeCustomerId: customerId },
        });
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?cancelled=true`,
        metadata: { orgId: ctx.orgId },
      });

      return { url: session.url };
    }),

  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const org = await ctx.prisma.organization.findUnique({
      where: { id: ctx.orgId },
      select: { stripeSubscriptionId: true },
    });

    if (!org?.stripeSubscriptionId) {
      throw new Error("No active subscription");
    }

    const stripe = getStripe();
    await stripe.subscriptions.cancel(org.stripeSubscriptionId);

    await ctx.prisma.organization.update({
      where: { id: ctx.orgId },
      data: { plan: "FREE", stripeSubscriptionId: null },
    });

    return { success: true };
  }),
});
