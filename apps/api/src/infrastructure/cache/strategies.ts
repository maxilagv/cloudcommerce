import type { CacheClient } from "./client.js";

const ensureConnected = async (cache: CacheClient): Promise<void> => {
  if (cache.status === "wait") {
    await cache.connect();
  }
};

export const cacheGetJson = async <T>(cache: CacheClient, key: string): Promise<T | null> => {
  try {
    await ensureConnected(cache);
    const raw = await cache.get(key);
    if (raw === null) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const cacheSetJson = async <T>(
  cache: CacheClient,
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> => {
  try {
    await ensureConnected(cache);
    await cache.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Dashboard cache is an optimization; Redis outages must not fail reads.
  }
};

export const cacheDeleteByPrefixes = async (
  cache: CacheClient,
  prefixes: readonly string[],
): Promise<void> => {
  try {
    await ensureConnected(cache);
    for (const prefix of prefixes) {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await cache.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
        if (keys.length > 0) {
          await cache.del(...keys);
        }
        cursor = nextCursor;
      } while (cursor !== "0");
    }
  } catch {
    // Cache invalidation is best-effort; short TTLs bound stale dashboard data.
  }
};
