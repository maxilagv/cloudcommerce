import * as schema from "@cloudcommerce/database";
import { mediaAsset, outboxEvent } from "@cloudcommerce/database";
import { and, eq, lt, lte, sql as drizzleSql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pino from "pino";
import postgres from "postgres";
import sharp from "sharp";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  STORAGE_LOCAL_ROOT: z.string().min(1).default(".cloudcommerce-media"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

const env = envSchema.parse(process.env);
const logger = pino({ level: env.LOG_LEVEL });
const sql = postgres(env.DATABASE_URL, { max: 2, prepare: false });
const db = drizzle(sql, { schema });
const OUTBOX_LOCK_TIMEOUT_MS = 15 * 60 * 1000;

export async function processMediaOutboxBatch(limit = 10): Promise<void> {
  await recoverStaleProcessingEvents();
  const rows = await db
    .select()
    .from(outboxEvent)
    .where(and(eq(outboxEvent.status, "pending"), eq(outboxEvent.eventType, "media.process"), lte(outboxEvent.availableAt, new Date())))
    .limit(limit);

  for (const event of rows) {
    await processOne(event.id, event.payload);
  }
}

async function processOne(eventId: string, payload: Record<string, unknown>): Promise<void> {
  const parsed = mediaProcessPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    await markFailed(eventId, "invalid_payload");
    return;
  }

  await db
    .update(outboxEvent)
    .set({ status: "processing", lockedAt: new Date(), attempts: drizzleSql`${outboxEvent.attempts} + 1` })
    .where(eq(outboxEvent.id, eventId));

  try {
    const imagePath = resolve(env.STORAGE_LOCAL_ROOT, parsed.data.storageKey);
    const body = await readFile(imagePath);
    const dominantColor = await getDominantColor(body);
    const blurPlaceholder = await getBlurPlaceholder(body);
    await db
      .update(mediaAsset)
      .set({
        dominantColor,
        blurPlaceholder,
      })
      .where(eq(mediaAsset.id, parsed.data.mediaAssetId));
    await db
      .update(outboxEvent)
      .set({ status: "processed", lockedAt: null, processedAt: new Date(), lastError: null })
      .where(eq(outboxEvent.id, eventId));
  } catch (error: unknown) {
    logger.warn({ eventId, error: error instanceof Error ? error.message : "unknown" }, "Failed to process media outbox event");
    await markFailed(eventId, "media_processing_failed");
  }
}

async function getDominantColor(body: Buffer): Promise<string> {
  const stats = await sharp(body).stats();
  const dominant = stats.dominant;
  return `#${toHex(dominant.r)}${toHex(dominant.g)}${toHex(dominant.b)}`;
}

async function getBlurPlaceholder(body: Buffer): Promise<string> {
  const buffer = await sharp(body).resize(16, 16, { fit: "inside" }).jpeg({ quality: 35 }).toBuffer();
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

async function markFailed(eventId: string, reason: string): Promise<void> {
  await db.update(outboxEvent).set({ status: "failed", lockedAt: null, lastError: reason }).where(eq(outboxEvent.id, eventId));
}

async function recoverStaleProcessingEvents(): Promise<void> {
  await db
    .update(outboxEvent)
    .set({ status: "pending", lockedAt: null, lastError: "stale_processing_lock_recovered" })
    .where(and(
      eq(outboxEvent.status, "processing"),
      eq(outboxEvent.eventType, "media.process"),
      lt(outboxEvent.lockedAt, new Date(Date.now() - OUTBOX_LOCK_TIMEOUT_MS)),
    ));
}

const mediaProcessPayloadSchema = z.object({
  mediaAssetId: z.string().uuid(),
  storageKey: z.string().min(1),
});

const toHex = (value: number): string => value.toString(16).padStart(2, "0");
