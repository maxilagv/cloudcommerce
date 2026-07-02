import * as schema from "@cloudcommerce/database";
import { customerAddress, order, orderLine, outboxEvent, supplier, supplierOrderRef, supplierProductMap } from "@cloudcommerce/database";
import { SupplierForwardStatus } from "@cloudcommerce/types";
import { SupplierApiConfigSchema, SupplierForwardResponseSchema, type SupplierApiConfigInput } from "@cloudcommerce/validators";
import { and, eq, inArray, lte, sql as drizzleSql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { createDecipheriv, createHash, createHmac } from "node:crypto";
import pino from "pino";
import postgres from "postgres";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  COOKIE_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  ORDER_FORWARD_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(20),
  ORDER_FORWARD_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(15_000),
});

const env = envSchema.parse(process.env);
const logger = pino({ level: env.LOG_LEVEL });
const sql = postgres(env.DATABASE_URL, { max: 2, prepare: false });
const db = drizzle(sql, { schema });

const MAX_EVENT_ATTEMPTS = 5;
const MAX_FORWARD_ATTEMPTS = 5;
const RETRY_BACKOFF_MS = [60_000, 300_000, 900_000, 3_600_000] as const;

const cipherKey = createHash("sha256").update(`supplier-api-config:${env.COOKIE_SECRET}`).digest();

const payloadSchema = z.object({ orderId: z.string().uuid() });

/**
 * Consume OrderConfirmed del outbox y reenvía las líneas de la orden a cada
 * proveedor mapeado. Idempotente: supplier_order_ref con UNIQUE(order,supplier)
 * garantiza que los reintentos de cola no dupliquen pedidos al proveedor.
 */
export async function processOrderForwardBatch(batchSize = env.ORDER_FORWARD_BATCH_SIZE): Promise<void> {
  const events = await db
    .select()
    .from(outboxEvent)
    .where(and(eq(outboxEvent.status, "pending"), eq(outboxEvent.eventType, "OrderConfirmed"), lte(outboxEvent.availableAt, new Date())))
    .limit(batchSize);

  for (const event of events) {
    await processEvent(event.id, event.attempts, event.payload);
  }
}

async function processEvent(eventId: string, attempts: number, payload: Record<string, unknown>): Promise<void> {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    await db
      .update(outboxEvent)
      .set({ status: "failed", lastError: "invalid_payload", processedAt: new Date() })
      .where(eq(outboxEvent.id, eventId));
    return;
  }
  await db
    .update(outboxEvent)
    .set({ status: "processing", attempts: drizzleSql`${outboxEvent.attempts} + 1` })
    .where(eq(outboxEvent.id, eventId));
  try {
    const pendingRetry = await forwardOrder(parsed.data.orderId);
    if (pendingRetry && attempts + 1 < MAX_EVENT_ATTEMPTS) {
      const backoff = RETRY_BACKOFF_MS[Math.min(attempts, RETRY_BACKOFF_MS.length - 1)] ?? 3_600_000;
      await db
        .update(outboxEvent)
        .set({ status: "pending", availableAt: new Date(Date.now() + backoff), lastError: "supplier_unavailable" })
        .where(eq(outboxEvent.id, eventId));
      return;
    }
    await db
      .update(outboxEvent)
      .set({ status: "processed", processedAt: new Date(), lastError: null })
      .where(eq(outboxEvent.id, eventId));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "unknown_error";
    logger.error({ eventId, error: message }, "order forward failed");
    await db
      .update(outboxEvent)
      .set({
        status: attempts + 1 >= MAX_EVENT_ATTEMPTS ? "failed" : "pending",
        availableAt: new Date(Date.now() + (RETRY_BACKOFF_MS[Math.min(attempts, RETRY_BACKOFF_MS.length - 1)] ?? 3_600_000)),
        lastError: message,
      })
      .where(eq(outboxEvent.id, eventId));
  }
}

/** Devuelve true si algún proveedor quedó pendiente por indisponibilidad (reintentable). */
async function forwardOrder(orderId: string): Promise<boolean> {
  const orderRow = await db.query.order.findFirst({ where: eq(order.id, orderId) });
  if (!orderRow) {
    return false;
  }
  const lines = await db
    .select({ variantId: orderLine.variantId, quantity: orderLine.quantity, title: orderLine.productTitleSnapshot })
    .from(orderLine)
    .where(eq(orderLine.orderId, orderId));
  if (lines.length === 0) {
    return false;
  }
  const maps = await db
    .select()
    .from(supplierProductMap)
    .where(inArray(supplierProductMap.variantId, lines.map((line) => line.variantId)));
  const bySupplier = new Map<string, Array<{ externalId: string; quantity: number; title: string }>>();
  for (const line of lines) {
    const map = maps.find((candidate) => candidate.variantId === line.variantId);
    if (!map) continue;
    const grouped = bySupplier.get(map.supplierId) ?? [];
    grouped.push({ externalId: map.externalId, quantity: line.quantity, title: line.title });
    bySupplier.set(map.supplierId, grouped);
  }
  if (bySupplier.size === 0) {
    logger.warn({ orderId }, "order has no supplier-mapped lines; manual fulfillment required");
    return false;
  }

  const address = orderRow.shippingAddressId
    ? await db.query.customerAddress.findFirst({ where: eq(customerAddress.id, orderRow.shippingAddressId) })
    : null;

  let pendingRetry = false;
  for (const [supplierId, supplierLines] of bySupplier) {
    const retry = await forwardToSupplier(orderId, orderRow.orderNumber, supplierId, supplierLines, address ?? null);
    pendingRetry = pendingRetry || retry;
  }
  return pendingRetry;
}

async function forwardToSupplier(
  orderId: string,
  orderNumber: string,
  supplierId: string,
  lines: Array<{ externalId: string; quantity: number; title: string }>,
  address: typeof customerAddress.$inferSelect | null,
): Promise<boolean> {
  const idempotencyKey = createHash("sha256").update(`forward:${orderId}:${supplierId}`).digest("hex");
  await db
    .insert(supplierOrderRef)
    .values({ id: uuidv7(), orderId, supplierId, idempotencyKey, status: "PENDING", attempts: 0 })
    .onConflictDoNothing({ target: [supplierOrderRef.orderId, supplierOrderRef.supplierId] });
  const ref = await db.query.supplierOrderRef.findFirst({
    where: and(eq(supplierOrderRef.orderId, orderId), eq(supplierOrderRef.supplierId, supplierId)),
  });
  if (!ref || ref.status === SupplierForwardStatus.SENT || ref.status === SupplierForwardStatus.ACCEPTED) {
    return false;
  }
  if (ref.attempts >= MAX_FORWARD_ATTEMPTS || ref.status === SupplierForwardStatus.REJECTED) {
    return false;
  }

  const supplierRow = await db.query.supplier.findFirst({ where: eq(supplier.id, supplierId) });
  if (!supplierRow?.isActive) {
    await updateRef(ref.id, SupplierForwardStatus.FAILED, null, "supplier_inactive", false);
    return false;
  }
  const apiConfig = supplierRow.apiConfigEnc ? decryptApiConfig(supplierRow.apiConfigEnc) : null;
  if (!apiConfig) {
    await updateRef(ref.id, SupplierForwardStatus.FAILED, null, "api_not_configured", false);
    return false;
  }

  const body = JSON.stringify({
    orderNumber,
    externalReference: idempotencyKey,
    lines,
    shippingAddress: address
      ? {
          recipientName: address.recipientName,
          province: address.province,
          city: address.city,
          street: address.street,
          streetNumber: address.streetNumber,
          postalCode: address.postalCode,
        }
      : null,
  });
  const headers: Record<string, string> = { "content-type": "application/json", "idempotency-key": idempotencyKey };
  if (apiConfig.authKind === "api_key" && apiConfig.apiKey) {
    headers["x-api-key"] = apiConfig.apiKey;
  } else if (apiConfig.authKind === "bearer" && apiConfig.apiKey) {
    headers.authorization = `Bearer ${apiConfig.apiKey}`;
  } else if (apiConfig.authKind === "hmac" && apiConfig.apiKey) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    headers["x-timestamp"] = timestamp;
    headers["x-signature"] = createHmac("sha256", apiConfig.apiKey).update(`${timestamp}.${body}`).digest("hex");
  }

  try {
    const response = await fetch(`${apiConfig.baseUrl.replace(/\/$/, "")}/orders`, {
      method: "POST",
      redirect: "error",
      headers,
      body,
      signal: AbortSignal.timeout(env.ORDER_FORWARD_TIMEOUT_MS),
    });
    if (response.status >= 500) {
      await updateRef(ref.id, SupplierForwardStatus.FAILED, null, "upstream_unavailable", true);
      return true;
    }
    const parsed = SupplierForwardResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      await updateRef(ref.id, SupplierForwardStatus.FAILED, null, "invalid_response", true);
      return true;
    }
    if (!response.ok || !parsed.data.accepted) {
      await updateRef(ref.id, SupplierForwardStatus.REJECTED, null, parsed.data.reason ?? "supplier_rejected", true);
      await db.insert(outboxEvent).values({
        id: uuidv7(),
        aggregateType: "supplier",
        aggregateId: supplierId,
        eventType: "SupplierOrderRejected",
        payload: { orderId, supplierId },
      });
      return false;
    }
    await updateRef(ref.id, SupplierForwardStatus.ACCEPTED, parsed.data.externalOrderId ?? null, null, true);
    await db.insert(outboxEvent).values({
      id: uuidv7(),
      aggregateType: "supplier",
      aggregateId: supplierId,
      eventType: "SupplierOrderForwarded",
      payload: { orderId, supplierId, externalOrderId: parsed.data.externalOrderId ?? null },
    });
    logger.info({ orderId, supplierId }, "order forwarded to supplier");
    return false;
  } catch {
    await updateRef(ref.id, SupplierForwardStatus.FAILED, null, "upstream_unavailable", true);
    return true;
  }
}

async function updateRef(
  refId: string,
  status: SupplierForwardStatus,
  externalOrderId: string | null,
  lastError: string | null,
  incrementAttempts: boolean,
): Promise<void> {
  await db
    .update(supplierOrderRef)
    .set({
      status,
      externalOrderId,
      lastError,
      ...(incrementAttempts ? { attempts: drizzleSql`${supplierOrderRef.attempts} + 1` } : {}),
      updatedAt: new Date(),
    })
    .where(eq(supplierOrderRef.id, refId));
}

function decryptApiConfig(payload: string): SupplierApiConfigInput | null {
  try {
    const [version, ivPart, tagPart, dataPart] = payload.split(":");
    if (version !== "v1" || !ivPart || !tagPart || !dataPart) {
      return null;
    }
    const decipher = createDecipheriv("aes-256-gcm", cipherKey, Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]);
    const parsed = SupplierApiConfigSchema.safeParse(JSON.parse(decrypted.toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
