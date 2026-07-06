import * as schema from "@cloudcommerce/database";
import {
  aiConversation,
  aiMessage,
  category,
  customer,
  customerAiProfile,
  order,
  orderLine,
  outboxEvent,
  price,
  product,
  productVariant,
} from "@cloudcommerce/database";
import { OrderStatus, ProductStatus } from "@cloudcommerce/types";
import { and, desc, eq, inArray, isNotNull, isNull, lt, lte, notInArray, or, sql as drizzleSql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { randomUUID } from "node:crypto";
import pino from "pino";
import postgres from "postgres";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  AI_SERVICE_URL: z.string().url().optional(),
  AI_SERVICE_TOKEN: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  STORE_NAME: z.string().min(1).default("CloudCommerce"),
  ENGAGEMENT_OUTREACH_COOLDOWN_DAYS: z.coerce.number().int().min(1).max(90).default(7),
});

const env = envSchema.parse(process.env);
const logger = pino({ level: env.LOG_LEVEL });
const sql = postgres(env.DATABASE_URL, { max: 2, prepare: false });
const db = drizzle(sql, { schema });

const ANALYZE_BATCH = 5;
const OUTREACH_BATCH = 3;
const PURCHASE_LINES_LIMIT = 30;
const SALE_CANDIDATES_LIMIT = 12;
const HISTORY_TURNS = 10;
const AI_TIMEOUT_MS = 60_000;
const POST_PURCHASE_WINDOW_DAYS = 10;
const WHATSAPP_CHANNEL = "whatsapp";
const OUTBOX_EVENT_SEND = "engagement.message.send";

const usageSchema = z.object({
  costMinor: z.number().int().min(0),
  currency: z.literal("ARS"),
  unit: z.enum(["tokens", "image"]),
  amount: z.number().int().min(0),
});

const analyzeResponseSchema = z.object({
  profile: z.object({
    interests: z.array(z.string()).max(15),
    segments: z.array(z.string()).max(8),
    priceSensitivity: z.enum(["low", "medium", "high"]),
    buyingPatterns: z.array(z.string()).max(8),
    recommendedCategories: z.array(z.string()).max(8),
    nextBestActions: z.array(z.string()).max(6),
    summary: z.string().max(1_000),
    confidence: z.number().int().min(0).max(100),
  }),
  model: z.string().min(1),
  usage: usageSchema,
});

const outreachResponseSchema = z.object({
  message: z.string().min(1).max(1_200),
  reasoning: z.string().max(800),
  recommendedProductIds: z.array(z.string()).max(6),
  shouldSend: z.boolean(),
  model: z.string().min(1),
  usage: usageSchema,
});

/**
 * Seguimiento autónomo de clientes:
 * 1) Analiza (o re-analiza) hasta 5 clientes con consentimiento de WhatsApp y
 *    actividad de compra nueva desde el último análisis.
 * 2) Genera outreach para hasta 3 clientes con perfil fresco cuya conversación
 *    respeta el cooldown y no tiene envíos pendientes.
 * Si falta configuración de IA o de WhatsApp, no hace nada (silencioso).
 */
export async function processEngagementFollowupBatch(): Promise<void> {
  if (!env.AI_SERVICE_URL || !env.AI_SERVICE_TOKEN || !env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    return;
  }
  await analyzeStaleProfiles();
  await generateOutreachBatch();
}

// ---------------------------------------------------------------------------
// Paso 1: análisis de perfiles
// ---------------------------------------------------------------------------

const consentGrantedSql = drizzleSql`exists (
  select 1 from customer_consent cc
  where cc.customer_id = ${customer.id}
    and cc.kind = 'marketing_whatsapp'
    and cc.granted = true
    and cc.granted_at = (
      select max(cc2.granted_at) from customer_consent cc2
      where cc2.customer_id = ${customer.id} and cc2.kind = 'marketing_whatsapp'
    )
)`;

async function analyzeStaleProfiles(): Promise<void> {
  const candidates = await db
    .select({ id: customer.id })
    .from(customer)
    .where(and(
      isNull(customer.deletedAt),
      isNotNull(customer.whatsapp),
      consentGrantedSql,
      drizzleSql`(
        not exists (select 1 from customer_ai_profile p where p.customer_id = ${customer.id})
        or exists (
          select 1 from customer_ai_profile p
          where p.customer_id = ${customer.id}
            and coalesce(p.last_order_seen_at, 'epoch'::timestamptz) < coalesce((
              select max(o.created_at) from "order" o
              where o.customer_id = ${customer.id} and o.status not in ('DRAFT', 'CANCELLED')
            ), 'epoch'::timestamptz)
        )
      )`,
    ))
    .limit(ANALYZE_BATCH);

  for (const candidate of candidates) {
    try {
      await analyzeCustomer(candidate.id);
    } catch (error: unknown) {
      logger.error(
        { customerId: candidate.id, error: error instanceof Error ? error.message : "unknown" },
        "engagement followup: analyze failed",
      );
    }
  }
}

type Snapshot = {
  customerId: string;
  firstName: string;
  tier: string;
  locale: string;
  purchases: Array<{
    productTitle: string;
    categoryName: string;
    quantity: number;
    unitPriceMinor: number | null;
    purchasedAt: string | null;
  }>;
  lastOrderAt: Date | null;
};

async function buildSnapshot(customerId: string): Promise<Snapshot | null> {
  const row = await db.query.customer.findFirst({ where: and(eq(customer.id, customerId), isNull(customer.deletedAt)) });
  if (!row) {
    return null;
  }
  const purchases = await db
    .select({
      productTitle: orderLine.productTitleSnapshot,
      categoryName: category.name,
      quantity: orderLine.quantity,
      unitPriceMinor: orderLine.unitPriceMinor,
      purchasedAt: order.createdAt,
    })
    .from(orderLine)
    .innerJoin(order, eq(orderLine.orderId, order.id))
    .leftJoin(productVariant, eq(orderLine.variantId, productVariant.id))
    .leftJoin(product, eq(productVariant.productId, product.id))
    .leftJoin(category, eq(product.categoryId, category.id))
    .where(and(eq(order.customerId, customerId), notInArray(order.status, [OrderStatus.DRAFT, OrderStatus.CANCELLED])))
    .orderBy(desc(order.createdAt), desc(orderLine.id))
    .limit(PURCHASE_LINES_LIMIT);
  return {
    customerId: row.id,
    firstName: row.firstName,
    tier: row.tier,
    locale: "es-AR",
    purchases: purchases.map((line) => ({
      productTitle: line.productTitle,
      categoryName: line.categoryName ?? "",
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
      purchasedAt: line.purchasedAt.toISOString(),
    })),
    lastOrderAt: purchases[0]?.purchasedAt ?? null,
  };
}

function profilePayload(row: typeof customerAiProfile.$inferSelect): Record<string, unknown> {
  return {
    interests: row.interests,
    segments: row.segments,
    priceSensitivity: row.priceSensitivity,
    buyingPatterns: row.buyingPatterns,
    recommendedCategories: row.recommendedCategories,
    nextBestActions: row.nextBestActions,
    summary: row.summary,
    confidence: row.confidence,
  };
}

async function analyzeCustomer(customerId: string): Promise<typeof customerAiProfile.$inferSelect | null> {
  const snapshot = await buildSnapshot(customerId);
  if (!snapshot) {
    return null;
  }
  const previous = await db.query.customerAiProfile.findFirst({ where: eq(customerAiProfile.customerId, customerId) });
  const generationId = randomUUID();
  const response = await callAiService("customers/analyze-profile", generationId, {
    generationId,
    customer: {
      customerId: snapshot.customerId,
      firstName: snapshot.firstName,
      tier: snapshot.tier,
      locale: snapshot.locale,
      purchases: snapshot.purchases,
      previousProfile: previous ? profilePayload(previous) : null,
    },
  });
  const parsed = analyzeResponseSchema.safeParse(response);
  if (!parsed.success) {
    logger.warn({ customerId }, "engagement followup: invalid analyze response");
    return null;
  }
  const values = {
    customerId,
    interests: parsed.data.profile.interests,
    segments: parsed.data.profile.segments,
    priceSensitivity: parsed.data.profile.priceSensitivity,
    buyingPatterns: parsed.data.profile.buyingPatterns,
    recommendedCategories: parsed.data.profile.recommendedCategories,
    nextBestActions: parsed.data.profile.nextBestActions,
    summary: parsed.data.profile.summary,
    confidence: parsed.data.profile.confidence,
    model: parsed.data.model,
    lastAnalyzedAt: new Date(),
    lastOrderSeenAt: snapshot.lastOrderAt,
  };
  const [stored] = await db
    .insert(customerAiProfile)
    .values({ id: uuidv7(), ...values })
    .onConflictDoUpdate({ target: customerAiProfile.customerId, set: { ...values, updatedAt: new Date() } })
    .returning();
  logger.info({ customerId }, "engagement followup: profile analyzed");
  return stored ?? null;
}

// ---------------------------------------------------------------------------
// Paso 2: outreach autónomo
// ---------------------------------------------------------------------------

async function generateOutreachBatch(): Promise<void> {
  const cooldownCutoff = new Date(Date.now() - env.ENGAGEMENT_OUTREACH_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ profile: customerAiProfile, whatsapp: customer.whatsapp })
    .from(customerAiProfile)
    .innerJoin(customer, eq(customerAiProfile.customerId, customer.id))
    .leftJoin(
      aiConversation,
      and(eq(aiConversation.customerId, customer.id), eq(aiConversation.channel, WHATSAPP_CHANNEL)),
    )
    .where(and(
      isNull(customer.deletedAt),
      isNotNull(customer.whatsapp),
      isNotNull(customerAiProfile.lastAnalyzedAt),
      consentGrantedSql,
      or(
        isNull(aiConversation.id),
        and(
          eq(aiConversation.autopilot, true),
          eq(aiConversation.status, "ACTIVE"),
          or(isNull(aiConversation.lastOutreachAt), lt(aiConversation.lastOutreachAt, cooldownCutoff)),
          drizzleSql`not exists (
            select 1 from ai_message m
            where m.conversation_id = ${aiConversation.id} and m.direction = 'OUT' and m.status = 'PENDING'
          )`,
        ),
      ) ?? drizzleSql`false`,
    ))
    .orderBy(desc(customerAiProfile.lastAnalyzedAt))
    .limit(OUTREACH_BATCH);

  if (rows.length === 0) {
    return;
  }
  const candidates = await listSaleCandidates();
  for (const row of rows) {
    try {
      await outreachCustomer(row.profile, candidates);
    } catch (error: unknown) {
      logger.error(
        { customerId: row.profile.customerId, error: error instanceof Error ? error.message : "unknown" },
        "engagement followup: outreach failed",
      );
    }
  }
}

async function outreachCustomer(
  profile: typeof customerAiProfile.$inferSelect,
  candidates: Array<Record<string, unknown>>,
): Promise<void> {
  const snapshot = await buildSnapshot(profile.customerId);
  if (!snapshot) {
    return;
  }
  const lastOrderAt = profile.lastOrderSeenAt ?? snapshot.lastOrderAt;
  const goal =
    lastOrderAt && Date.now() - lastOrderAt.getTime() < POST_PURCHASE_WINDOW_DAYS * 24 * 60 * 60 * 1000
      ? "post_purchase"
      : "cross_sell";

  const existingConversation = await db.query.aiConversation.findFirst({
    where: and(eq(aiConversation.customerId, profile.customerId), eq(aiConversation.channel, WHATSAPP_CHANNEL)),
  });
  const history = existingConversation
    ? (
        await db
          .select()
          .from(aiMessage)
          .where(eq(aiMessage.conversationId, existingConversation.id))
          .orderBy(desc(aiMessage.createdAt), desc(aiMessage.id))
          .limit(HISTORY_TURNS)
      )
        .reverse()
        .map((message) => ({
          role: message.direction === "IN" ? "customer" : message.author === "ADMIN" ? "agent" : "assistant",
          content: message.content,
          sentAt: (message.sentAt ?? message.createdAt).toISOString(),
        }))
    : [];

  const generationId = randomUUID();
  const response = await callAiService("customers/outreach", generationId, {
    generationId,
    goal,
    customer: {
      customerId: snapshot.customerId,
      firstName: snapshot.firstName,
      tier: snapshot.tier,
      locale: snapshot.locale,
      purchases: snapshot.purchases,
      previousProfile: profilePayload(profile),
    },
    profile: profilePayload(profile),
    candidates,
    conversation: history,
    storeName: env.STORE_NAME,
  });
  const parsed = outreachResponseSchema.safeParse(response);
  if (!parsed.success) {
    logger.warn({ customerId: profile.customerId }, "engagement followup: invalid outreach response");
    return;
  }
  if (!parsed.data.shouldSend) {
    logger.info({ customerId: profile.customerId, goal }, "engagement followup: outreach skipped by model");
    return;
  }

  // Asegura la conversación y encola el envío por el worker de WhatsApp.
  await db
    .insert(aiConversation)
    .values({ id: uuidv7(), customerId: profile.customerId, channel: WHATSAPP_CHANNEL })
    .onConflictDoNothing({ target: [aiConversation.customerId, aiConversation.channel] });
  const conversation = await db.query.aiConversation.findFirst({
    where: and(eq(aiConversation.customerId, profile.customerId), eq(aiConversation.channel, WHATSAPP_CHANNEL)),
  });
  if (!conversation) {
    return;
  }
  const messageId = uuidv7();
  await db.insert(aiMessage).values({
    id: messageId,
    conversationId: conversation.id,
    direction: "OUT",
    author: "AI",
    content: parsed.data.message,
    status: "PENDING",
    goal,
    recommendedProductIds: parsed.data.recommendedProductIds,
  });
  await db.insert(outboxEvent).values({
    id: uuidv7(),
    aggregateType: "ai_message",
    aggregateId: messageId,
    eventType: OUTBOX_EVENT_SEND,
    payload: { messageId },
  });
  const now = new Date();
  await db
    .update(aiConversation)
    .set({ lastOutreachAt: now, lastMessageAt: now, updatedAt: now })
    .where(eq(aiConversation.id, conversation.id));
  logger.info({ customerId: profile.customerId, goal, messageId }, "engagement followup: outreach queued");
}

async function listSaleCandidates(): Promise<Array<Record<string, unknown>>> {
  const rows = await db
    .select({ productId: product.id, title: product.title, categoryName: category.name })
    .from(product)
    .innerJoin(category, eq(product.categoryId, category.id))
    .where(and(eq(product.status, ProductStatus.PUBLISHED), isNull(product.deletedAt)))
    .orderBy(desc(product.publishedAt))
    .limit(SALE_CANDIDATES_LIMIT);
  if (rows.length === 0) {
    return [];
  }
  const variants = await db
    .select({ variantId: productVariant.id, productId: productVariant.productId })
    .from(productVariant)
    .where(and(inArray(productVariant.productId, rows.map((row) => row.productId)), eq(productVariant.isActive, true)));
  const priceByVariant = new Map<string, number>();
  if (variants.length > 0) {
    const now = new Date();
    const prices = await db
      .select({ variantId: price.variantId, amountMinor: price.amountMinor })
      .from(price)
      .where(
        and(
          inArray(price.variantId, variants.map((variant) => variant.variantId)),
          lte(price.validFrom, now),
          or(isNull(price.validTo), drizzleSql`${price.validTo} > ${now}`),
        ),
      )
      .orderBy(desc(price.validFrom));
    for (const row of prices) {
      if (!priceByVariant.has(row.variantId)) {
        priceByVariant.set(row.variantId, row.amountMinor);
      }
    }
  }
  const priceByProduct = new Map<string, number>();
  for (const variant of variants) {
    const amount = priceByVariant.get(variant.variantId);
    if (amount === undefined) continue;
    const current = priceByProduct.get(variant.productId);
    if (current === undefined || amount < current) {
      priceByProduct.set(variant.productId, amount);
    }
  }
  return rows.map((row) => ({
    productId: row.productId,
    title: row.title,
    categoryName: row.categoryName,
    priceMinor: priceByProduct.get(row.productId) ?? null,
    currency: "ARS",
    inStock: true,
  }));
}

// ---------------------------------------------------------------------------
// Cliente HTTP hacia el servicio IA
// ---------------------------------------------------------------------------

async function callAiService(path: string, generationId: string, body: Record<string, unknown>): Promise<unknown> {
  const baseUrl = env.AI_SERVICE_URL ?? "";
  const url = `${baseUrl.replace(/\/$/, "")}/internal/ai/v1/${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.AI_SERVICE_TOKEN ?? ""}`,
      "x-request-id": randomUUID(),
      "idempotency-key": generationId,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`ai_service_${response.status}`);
  }
  return response.json();
}
