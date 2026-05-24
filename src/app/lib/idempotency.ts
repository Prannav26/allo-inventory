import { redis } from "./redis";

interface StoredResponse {
  status: number;
  body: unknown;
}

/**
 * Check if we have a stored response for this idempotency key.
 */
export async function getIdempotentResponse(
  key: string
): Promise<StoredResponse | null> {
  const raw = await redis.get<string>(`idempotency:${key}`);
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

/**
 * Store a response for an idempotency key (1 hour TTL).
 */
export async function setIdempotentResponse(
  key: string,
  status: number,
  body: unknown
): Promise<void> {
  await redis.set(
    `idempotency:${key}`,
    JSON.stringify({ status, body }),
    { ex: 3600 }
  );
}