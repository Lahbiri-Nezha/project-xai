import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, _receiver) {
    return Reflect.get(getStripe(), prop, _receiver);
  },
});

export const PLANS = {
  FREE: { name: "Free", leadsPerMonth: 500, priceId: null },
  STARTER: {
    name: "Starter",
    leadsPerMonth: 5000,
    priceId: process.env.STRIPE_STARTER_PRICE_ID!,
  },
  PRO: {
    name: "Pro",
    leadsPerMonth: 50000,
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
  },
  ENTERPRISE: { name: "Enterprise", leadsPerMonth: -1, priceId: null },
} as const;

export type PlanKey = keyof typeof PLANS;
