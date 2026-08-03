import { Redis } from "@upstash/redis";

function createRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return new Redis({ url, token });
}

let _redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!_redis) {
    _redis = createRedisClient();
  }
  return _redis;
}

export const redis = new Proxy({} as Redis, {
  get(_target, prop, _receiver) {
    const client = getRedis();
    if (!client) {
      if (prop === "then") return undefined;
      throw new Error(
        "Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
      );
    }
    return Reflect.get(client, prop, _receiver);
  },
});
