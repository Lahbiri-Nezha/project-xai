"use server";

import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getOrganizationId } from "@/lib/auth-utils";
import { PLANS } from "@/lib/stripe";

export async function createCheckoutSession(plan: "STARTER" | "PRO") {
  const orgId = await getOrganizationId();
  const priceId = PLANS[plan].priceId;
  if (!priceId) throw new Error("Invalid plan");

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  let customerId = org?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org?.name,
      metadata: { orgId },
    });
    customerId = customer.id;
    await prisma.organization.update({
      where: { id: orgId },
      data: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing?canceled=true`,
    metadata: { orgId },
  });

  return { url: session.url };
}
