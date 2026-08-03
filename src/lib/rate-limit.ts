import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "./redis";

export type PlanKey = "FREE" | "STARTER" | "PRO" | "ENTERPRISE";

const GENERAL_LIMITS: Record<PlanKey, number> = {
  FREE: 100,
  STARTER: 300,
  PRO: 900,
  ENTERPRISE: 3000,
};

const EXPENSIVE_LIMITS: Record<PlanKey, number> = {
  FREE: 10,
  STARTER: 40,
  PRO: 120,
  ENTERPRISE: 400,
};

const COPILOT_LIMITS: Record<PlanKey, number> = {
  FREE: 10,
  STARTER: 30,
  PRO: 100,
  ENTERPRISE: 300,
};

function createRatelimit(requests: number, window: "1 h") {
  const redisClient = getRedis();
  if (!redisClient) return null;

  return new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: true,
  });
}

const _general = new Map<PlanKey, Ratelimit>();
const _expensive = new Map<PlanKey, Ratelimit>();
const _copilot = new Map<PlanKey, Ratelimit>();

export function getGeneralRatelimit(plan: PlanKey = "FREE"): Ratelimit | null {
  const existing = _general.get(plan);
  if (existing) return existing;
  const client = createRatelimit(GENERAL_LIMITS[plan], "1 h");
  if (!client) return null;
  _general.set(plan, client);
  return client;
}

export function getExpensiveRatelimit(plan: PlanKey = "FREE"): Ratelimit | null {
  const existing = _expensive.get(plan);
  if (existing) return existing;
  const client = createRatelimit(EXPENSIVE_LIMITS[plan], "1 h");
  if (!client) return null;
  _expensive.set(plan, client);
  return client;
}

export function getCopilotRatelimit(plan: PlanKey = "FREE"): Ratelimit | null {
  const existing = _copilot.get(plan);
  if (existing) return existing;
  const client = createRatelimit(COPILOT_LIMITS[plan], "1 h");
  if (!client) return null;
  _copilot.set(plan, client);
  return client;
}

function proxyFor(get: () => Ratelimit | null): Ratelimit {
  return new Proxy({} as Ratelimit, {
    get(_target, prop, _receiver) {
      const client = get();
      if (!client) {
        if (prop === "then") return undefined;
        throw new Error("Rate limiting is not configured. Set UPSTASH env vars.");
      }
      return Reflect.get(client, prop, _receiver);
    },
  });
}

export const ratelimit = proxyFor(() => getGeneralRatelimit());
export const expensiveRatelimit = proxyFor(() => getExpensiveRatelimit());
export const copilotRateLimit = proxyFor(() => getCopilotRatelimit());
