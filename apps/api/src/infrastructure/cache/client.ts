import { Redis } from "ioredis";

export type CacheClient = Redis;

export const createCacheClient = (redisUrl: string): CacheClient =>
  new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
  });

export const checkCacheHealth = async (cache: CacheClient): Promise<boolean> => {
  try {
    if (cache.status === "wait") {
      await cache.connect();
    }
    const pong = await cache.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
};
