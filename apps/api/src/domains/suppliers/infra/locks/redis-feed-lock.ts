import type { CacheClient } from "../../../../infrastructure/cache/client.js";
import type { FeedLockPort } from "../../application/ports.js";

const LOCK_TTL_SECONDS = 15 * 60;

/** Una sola corrida por feed a la vez; el TTL evita locks huérfanos si el proceso muere. */
export class RedisFeedLock implements FeedLockPort {
  public constructor(private readonly cache: CacheClient) {}

  public async acquire(feedId: string): Promise<boolean> {
    const result = await this.cache.set(`supplier:feed-lock:${feedId}`, "1", "EX", LOCK_TTL_SECONDS, "NX");
    return result === "OK";
  }

  public async release(feedId: string): Promise<void> {
    await this.cache.del(`supplier:feed-lock:${feedId}`);
  }
}
