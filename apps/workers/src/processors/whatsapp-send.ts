import * as schema from "@cloudcommerce/database";
import { aiConversation, aiMessage, customer, customerContactLog, outboxEvent } from "@cloudcommerce/database";
import { CustomerContactChannel, CustomerContactDirection } from "@cloudcommerce/types";
import { and, eq, lt, lte, sql as drizzleSql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import pino from "pino";
import postgres from "postgres";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
});

const env = envSchema.parse(process.env);
const logger = pino({ level: env.LOG_LEVEL });
const sql = postgres(env.DATABASE_URL, { max: 2, prepare: false });
const db = drizzle(sql, { schema });

const EVENT_TYPE = "engagement.message.send";
const OUTBOX_LOCK_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_EVENT_ATTEMPTS = 5;
const RETRY_BACKOFF_MS = [60_000, 300_000, 900_000, 3_600_000] as const;
const SEND_TIMEOUT_MS = 30_000;
const GRAPH_BASE_URL = "https://graph.facebook.com/v20.0";

const payloadSchema = z.object({ messageId: z.string().uuid() });

const sendResponseSchema = z.object({
  messages: z.array(z.object({ id: z.string().min(1) })).min(1),
});

/**
 * Consume engagement.message.send del outbox y envía el ai_message por la
 * Cloud API de WhatsApp. Idempotente por estado del mensaje: solo se envían
 * mensajes en PENDING.
 */
export async function processWhatsappSendBatch(limit = 10): Promise<void> {
  await recoverStaleProcessingEvents();
  const events = await db
    .select()
    .from(outboxEvent)
    .where(and(eq(outboxEvent.status, "pending"), eq(outboxEvent.eventType, EVENT_TYPE), lte(outboxEvent.availableAt, new Date())))
    .limit(limit);

  for (const event of events) {
    await processEvent(event.id, event.attempts, event.payload);
  }
}

async function processEvent(eventId: string, attempts: number, payload: Record<string, unknown>): Promise<void> {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    await markOutbox(eventId, "failed", "invalid_payload");
    return;
  }
  await db
    .update(outboxEvent)
    .set({ status: "processing", lockedAt: new Date(), attempts: drizzleSql`${outboxEvent.attempts} + 1` })
    .where(eq(outboxEvent.id, eventId));
  try {
    const outcome = await sendMessage(parsed.data.messageId);
    if (outcome.kind === "retry" && attempts + 1 < MAX_EVENT_ATTEMPTS) {
      const backoff = RETRY_BACKOFF_MS[Math.min(attempts, RETRY_BACKOFF_MS.length - 1)] ?? 3_600_000;
      await db
        .update(outboxEvent)
        .set({ status: "pending", lockedAt: null, availableAt: new Date(Date.now() + backoff), lastError: outcome.reason })
        .where(eq(outboxEvent.id, eventId));
      return;
    }
    if (outcome.kind === "retry") {
      // Se agotaron los reintentos: el mensaje queda FAILED.
      await failMessage(parsed.data.messageId, outcome.reason);
      await markOutbox(eventId, "failed", outcome.reason);
      return;
    }
    if (outcome.kind === "failed") {
      await markOutbox(eventId, "failed", outcome.reason);
      return;
    }
    await markOutbox(eventId, "processed", null);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "unknown_error";
    logger.error({ eventId, error: message }, "whatsapp send failed");
    await markOutbox(eventId, attempts + 1 >= MAX_EVENT_ATTEMPTS ? "failed" : "pending", message);
  }
}

type SendOutcome = { kind: "sent" } | { kind: "failed"; reason: string } | { kind: "retry"; reason: string };

async function sendMessage(messageId: string): Promise<SendOutcome> {
  const message = await db.query.aiMessage.findFirst({ where: eq(aiMessage.id, messageId) });
  if (!message) {
    return { kind: "failed", reason: "message_not_found" };
  }
  if (message.status !== "PENDING" || message.direction !== "OUT") {
    // Ya procesado por otra corrida (idempotencia).
    return { kind: "sent" };
  }
  const conversation = await db.query.aiConversation.findFirst({ where: eq(aiConversation.id, message.conversationId) });
  if (!conversation) {
    await failMessage(messageId, "conversation_not_found");
    return { kind: "failed", reason: "conversation_not_found" };
  }
  const customerRow = await db.query.customer.findFirst({ where: eq(customer.id, conversation.customerId) });
  const to = customerRow?.whatsapp?.replace(/\D/g, "") ?? "";
  if (!customerRow || to.length === 0) {
    await failMessage(messageId, "customer_whatsapp_missing");
    return { kind: "failed", reason: "customer_whatsapp_missing" };
  }
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    await failMessage(messageId, "whatsapp_not_configured");
    return { kind: "failed", reason: "whatsapp_not_configured" };
  }

  try {
    const response = await fetch(`${GRAPH_BASE_URL}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message.content },
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (response.status >= 500) {
      return { kind: "retry", reason: "upstream_unavailable" };
    }
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      await failMessage(messageId, detail || "send_rejected");
      return { kind: "failed", reason: "send_rejected" };
    }
    const parsed = sendResponseSchema.safeParse(await response.json());
    const waMessageId = parsed.success ? (parsed.data.messages[0]?.id ?? null) : null;
    if (!waMessageId) {
      await failMessage(messageId, "invalid_response");
      return { kind: "failed", reason: "invalid_response" };
    }
    await db
      .update(aiMessage)
      .set({ status: "SENT", waMessageId, sentAt: new Date(), errorMessage: null })
      .where(eq(aiMessage.id, messageId));
    // Espejo en el historial de contacto del cliente.
    await db.insert(customerContactLog).values({
      id: uuidv7(),
      customerId: conversation.customerId,
      channel: CustomerContactChannel.WHATSAPP,
      direction: CustomerContactDirection.OUT,
      note: message.content.slice(0, 200),
      createdBy: null,
    });
    logger.info({ messageId, waMessageId }, "whatsapp message sent");
    return { kind: "sent" };
  } catch {
    return { kind: "retry", reason: "upstream_unavailable" };
  }
}

async function failMessage(messageId: string, reason: string): Promise<void> {
  await db
    .update(aiMessage)
    .set({ status: "FAILED", errorMessage: reason.slice(0, 300) })
    .where(and(eq(aiMessage.id, messageId), eq(aiMessage.status, "PENDING")));
}

async function markOutbox(eventId: string, status: "processed" | "failed" | "pending", lastError: string | null): Promise<void> {
  await db
    .update(outboxEvent)
    .set({
      status,
      lockedAt: null,
      lastError,
      ...(status === "processed" ? { processedAt: new Date() } : {}),
      ...(status === "pending" ? { availableAt: new Date(Date.now() + 60_000) } : {}),
    })
    .where(eq(outboxEvent.id, eventId));
}

async function recoverStaleProcessingEvents(): Promise<void> {
  await db
    .update(outboxEvent)
    .set({ status: "pending", lockedAt: null, lastError: "stale_processing_lock_recovered" })
    .where(and(
      eq(outboxEvent.status, "processing"),
      eq(outboxEvent.eventType, EVENT_TYPE),
      lt(outboxEvent.lockedAt, new Date(Date.now() - OUTBOX_LOCK_TIMEOUT_MS)),
    ));
}
