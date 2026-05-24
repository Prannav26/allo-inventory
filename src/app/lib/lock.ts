import { redis } from "./redis";

/**
 * Acquire a distributed lock using Redis SET NX PX.
 * Returns the lock value on success, null on failure.
 */
export async function acquireLock(
  key: string,
  ttlMs = 5000
): Promise<string | null> {
  const value = crypto.randomUUID();
  const result = await redis.set(key, value, { nx: true, px: ttlMs });
  return result === "OK" ? value : null;
}

/**
 * Release a distributed lock using a Lua script for atomicity.
 * Only releases if the value matches (prevents releasing someone else's lock).
 */
export async function releaseLock(
  key: string,
  value: string
): Promise<boolean> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  const result = await redis.eval<number>(script, [key], [value]);
  return result === 1;
}