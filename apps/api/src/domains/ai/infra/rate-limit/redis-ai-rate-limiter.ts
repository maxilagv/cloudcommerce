import { AiGenerationKind } from "@cloudcommerce/types";
import type { CacheClient } from "../../../../infrastructure/cache/client.js";
import type { AiRateLimiterPort } from "../../application/ports.js";

const WINDOW_SECONDS = 60;

const LIMIT_PER_MINUTE: Record<AiGenerationKind, number> = {
  [AiGenerationKind.DESCRIPTION]: 30,
  [AiGenerationKind.SPECS]: 30,
  [AiGenerationKind.SEO]: 30,
  [AiGenerationKind.IMAGE]: 5,
  [AiGenerationKind.RECOMMENDATION]: 20,
  [AiGenerationKind.TRENDS]: 20,
  [AiGenerationKind.PRICING]: 20,
};

export class RedisAiRateLimiter implements AiRateLimiterPort {
  public constructor(private readonly cache: CacheClient) {}

  public async check(actorKey: string, kind: AiGenerationKind): Promise<number | null> {
    const key = `ai:rl:${kind}:${actorKey}`;
    try {
      const count = await this.cache.incr(key);
      if (count === 1) {
        await this.cache.expire(key, WINDOW_SECONDS);
      }
      if (count > LIMIT_PER_MINUTE[kind]) {
        const ttl = await this.cache.ttl(key);
        return ttl > 0 ? ttl : WINDOW_SECONDS;
      }
      return null;
    } catch {
      // Redis caído no debe tirar el panel: se degrada sin rate limit y la cuota de costo sigue vigente.
      return null;
    }
  }
}
