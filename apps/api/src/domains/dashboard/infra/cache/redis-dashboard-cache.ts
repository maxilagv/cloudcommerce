import type { CacheClient } from "../../../../infrastructure/cache/client.js";
import { cacheDeleteByPrefixes, cacheGetJson, cacheSetJson } from "../../../../infrastructure/cache/strategies.js";
import type { DashboardCachePort } from "../../application/ports.js";

export class RedisDashboardCache implements DashboardCachePort {
  public constructor(private readonly cache: CacheClient) {}

  public async get<T>(key: string): Promise<T | null> {
    return cacheGetJson<T>(this.cache, key);
  }

  public async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await cacheSetJson(this.cache, key, value, ttlSeconds);
  }

  public async invalidatePrefixes(prefixes: readonly string[]): Promise<void> {
    await cacheDeleteByPrefixes(this.cache, prefixes);
  }
}
