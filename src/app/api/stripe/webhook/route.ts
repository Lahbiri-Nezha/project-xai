import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function POST(req: Request) {
  try {
    const { stripe } = await import("@/lib/stripe");
    const { prisma } = await import("@/lib/prisma");

    const body = await req.text();
    const sig = (await headers()).get("stripe-signature")!;

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch {
      return new Response("Webhook signature verification failed", {
        status: 400,
      });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        await prisma.organization.update({
          where: { stripeCustomerId: session.customer as string },
          data: {
            stripeSubscriptionId: session.subscription as string,
            plan: "STARTER",
          },
        });
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const priceId = subscription.items.data[0]?.price.id;
        let plan: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" = "FREE";
        if (priceId === process.env.STRIPE_PRO_PRICE_ID) plan = "PRO";
        else if (priceId === process.env.STRIPE_STARTER_PRICE_ID)
          plan = "STARTER";

        await prisma.organization.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: { plan },
        });
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        await prisma.organization.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: { plan: "FREE", stripeSubscriptionId: null },
        });
        break;
      }
    }

    return new Response("ok");
  } catch {
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
