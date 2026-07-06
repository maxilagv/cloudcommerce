import { aiConversation, aiMessage, customer, customerAiProfile, outboxEvent } from "@cloudcommerce/database";
import type { AiConversationStatus, AiMessageAuthor, AiMessageDirection, AiMessageStatus } from "@cloudcommerce/types";
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { Database } from "../../../../infrastructure/database/client.js";
import type {
  EngagementConversationListRow,
  EngagementConversationRow,
  EngagementMessageRow,
  EngagementProfileListRow,
  EngagementProfileRow,
  EngagementRepository,
  InsertMessageRecord,
  UpdateConversationRecord,
  UpsertProfileRecord,
} from "../../application/ports.js";

type Cursor = { createdAt: Date; id: string };

export class DrizzleEngagementRepository implements EngagementRepository {
  public constructor(private readonly db: Database) {}

  public async upsertProfile(record: UpsertProfileRecord): Promise<EngagementProfileRow> {
    const values = {
      customerId: record.customerId,
      interests: record.interests,
      segments: record.segments,
      priceSensitivity: record.priceSensitivity,
      buyingPatterns: record.buyingPatterns,
      recommendedCategories: record.recommendedCategories,
      nextBestActions: record.nextBestActions,
      summary: record.summary,
      confidence: record.confidence,
      model: record.model,
      lastAnalyzedAt: record.lastAnalyzedAt,
      lastOrderSeenAt: record.lastOrderSeenAt,
    };
    const [row] = await this.db
      .insert(customerAiProfile)
      .values({ id: uuidv7(), ...values })
      .onConflictDoUpdate({
        target: customerAiProfile.customerId,
        set: { ...values, updatedAt: new Date() },
      })
      .returning();
    if (!row) {
      throw new Error("Failed to upsert customer AI profile");
    }
    return mapProfile(row);
  }

  public async findProfileByCustomerId(customerId: string): Promise<EngagementProfileRow | null> {
    const row = await this.db.query.customerAiProfile.findFirst({ where: eq(customerAiProfile.customerId, customerId) });
    return row ? mapProfile(row) : null;
  }

  public async listProfiles(input: {
    cursor?: string | undefined;
    limit: number;
    q?: string | undefined;
  }): Promise<{ items: EngagementProfileListRow[]; nextCursor: string | null }> {
    const conditions: SQL[] = [isNull(customer.deletedAt)];
    if (input.q !== undefined && input.q.length > 0) {
      conditions.push(ilike(customer.displayName, `%${escapeLike(input.q)}%`));
    }
    const cursor = decodeCursor(input.cursor);
    if (cursor) {
      conditions.push(
        or(
          lt(customerAiProfile.createdAt, cursor.createdAt),
          and(eq(customerAiProfile.createdAt, cursor.createdAt), lt(customerAiProfile.id, cursor.id)),
        ) ?? sql`false`,
      );
    }
    const rows = await this.db
      .select({
        profile: customerAiProfile,
        customerName: customer.displayName,
        tier: customer.tier,
        whatsapp: customer.whatsapp,
      })
      .from(customerAiProfile)
      .innerJoin(customer, eq(customerAiProfile.customerId, customer.id))
      .where(and(...conditions))
      .orderBy(desc(customerAiProfile.createdAt), desc(customerAiProfile.id))
      .limit(input.limit + 1);
    const visible = rows.slice(0, input.limit).map((row) => ({
      ...mapProfile(row.profile),
      customerName: row.customerName,
      tier: row.tier,
      whatsapp: row.whatsapp,
    }));
    const last = rows.length > input.limit ? rows[input.limit - 1] : null;
    return {
      items: visible,
      nextCursor: last ? encodeCursor({ createdAt: last.profile.createdAt, id: last.profile.id }) : null,
    };
  }

  public async ensureConversation(customerId: string, channel: string): Promise<EngagementConversationRow> {
    await this.db
      .insert(aiConversation)
      .values({ id: uuidv7(), customerId, channel })
      .onConflictDoNothing({ target: [aiConversation.customerId, aiConversation.channel] });
    const row = await this.db.query.aiConversation.findFirst({
      where: and(eq(aiConversation.customerId, customerId), eq(aiConversation.channel, channel)),
    });
    if (!row) {
      throw new Error("Failed to ensure AI conversation");
    }
    return mapConversation(row);
  }

  public async findConversationById(id: string): Promise<EngagementConversationRow | null> {
    const row = await this.db.query.aiConversation.findFirst({ where: eq(aiConversation.id, id) });
    return row ? mapConversation(row) : null;
  }

  public async listConversations(input: {
    cursor?: string | undefined;
    limit: number;
    needsHuman?: boolean | undefined;
    status?: AiConversationStatus | undefined;
  }): Promise<{ items: EngagementConversationListRow[]; nextCursor: string | null }> {
    const conditions: SQL[] = [];
    if (input.needsHuman !== undefined) conditions.push(eq(aiConversation.needsHuman, input.needsHuman));
    if (input.status !== undefined) conditions.push(eq(aiConversation.status, input.status));
    const cursor = decodeCursor(input.cursor);
    if (cursor) {
      conditions.push(
        or(
          lt(aiConversation.createdAt, cursor.createdAt),
          and(eq(aiConversation.createdAt, cursor.createdAt), lt(aiConversation.id, cursor.id)),
        ) ?? sql`false`,
      );
    }
    const query = this.db
      .select({
        conversation: aiConversation,
        customerName: customer.displayName,
        whatsapp: customer.whatsapp,
      })
      .from(aiConversation)
      .innerJoin(customer, eq(aiConversation.customerId, customer.id))
      .$dynamic()
      .orderBy(desc(aiConversation.createdAt), desc(aiConversation.id))
      .limit(input.limit + 1);
    const rows = conditions.length > 0 ? await query.where(and(...conditions)) : await query;
    const visibleRows = rows.slice(0, input.limit);

    // Último mensaje por conversación de la página (para el preview del listado).
    const ids = visibleRows.map((row) => row.conversation.id);
    const previews = new Map<string, { content: string; direction: string }>();
    if (ids.length > 0) {
      const lastMessages = await this.db
        .selectDistinctOn([aiMessage.conversationId], {
          conversationId: aiMessage.conversationId,
          content: aiMessage.content,
          direction: aiMessage.direction,
        })
        .from(aiMessage)
        .where(inArray(aiMessage.conversationId, ids))
        .orderBy(aiMessage.conversationId, desc(aiMessage.createdAt));
      for (const message of lastMessages) {
        previews.set(message.conversationId, { content: message.content, direction: message.direction });
      }
    }

    const visible = visibleRows.map((row) => {
      const last = previews.get(row.conversation.id) ?? null;
      return {
        ...mapConversation(row.conversation),
        customerName: row.customerName,
        whatsapp: row.whatsapp,
        lastMessagePreview: last ? truncate(last.content, 160) : null,
        lastMessageDirection: last ? (last.direction as AiMessageDirection) : null,
      };
    });
    const last = rows.length > input.limit ? rows[input.limit - 1] : null;
    return {
      items: visible,
      nextCursor: last ? encodeCursor({ createdAt: last.conversation.createdAt, id: last.conversation.id }) : null,
    };
  }

  public async updateConversation(record: UpdateConversationRecord): Promise<EngagementConversationRow | null> {
    const [row] = await this.db
      .update(aiConversation)
      .set({
        ...(record.autopilot !== undefined ? { autopilot: record.autopilot } : {}),
        ...(record.status !== undefined ? { status: record.status } : {}),
        ...(record.needsHuman !== undefined ? { needsHuman: record.needsHuman } : {}),
        ...(record.lastMessageAt !== undefined ? { lastMessageAt: record.lastMessageAt } : {}),
        ...(record.lastOutreachAt !== undefined ? { lastOutreachAt: record.lastOutreachAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(aiConversation.id, record.conversationId))
      .returning();
    return row ? mapConversation(row) : null;
  }

  public async insertMessage(record: InsertMessageRecord): Promise<EngagementMessageRow> {
    const [row] = await this.db
      .insert(aiMessage)
      .values({
        id: record.id,
        conversationId: record.conversationId,
        direction: record.direction,
        author: record.author,
        content: record.content,
        status: record.status,
        intent: record.intent ?? null,
        goal: record.goal ?? null,
        recommendedProductIds: record.recommendedProductIds ?? [],
        waMessageId: record.waMessageId ?? null,
        sentBy: record.sentBy ?? null,
      })
      .returning();
    if (!row) {
      throw new Error("Failed to insert AI message");
    }
    return mapMessage(row);
  }

  public async listMessages(conversationId: string, limit: number): Promise<EngagementMessageRow[]> {
    const rows = await this.db
      .select()
      .from(aiMessage)
      .where(eq(aiMessage.conversationId, conversationId))
      .orderBy(desc(aiMessage.createdAt), desc(aiMessage.id))
      .limit(limit);
    return rows.reverse().map(mapMessage);
  }

  public async findMessageByWaId(waMessageId: string): Promise<EngagementMessageRow | null> {
    const row = await this.db.query.aiMessage.findFirst({ where: eq(aiMessage.waMessageId, waMessageId) });
    return row ? mapMessage(row) : null;
  }

  public async findCustomerByWhatsapp(phone: string): Promise<{ id: string } | null> {
    const [row] = await this.db
      .select({ id: customer.id })
      .from(customer)
      .where(
        and(
          isNull(customer.deletedAt),
          isNotNull(customer.whatsapp),
          sql`regexp_replace(${customer.whatsapp}, '[^0-9]', '', 'g') = ${phone}`,
        ),
      )
      .orderBy(asc(customer.createdAt))
      .limit(1);
    return row ?? null;
  }

  public async enqueueOutbox(event: {
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(outboxEvent).values(event);
  }
}

const mapProfile = (row: typeof customerAiProfile.$inferSelect): EngagementProfileRow => ({
  id: row.id,
  customerId: row.customerId,
  interests: row.interests,
  segments: row.segments,
  priceSensitivity: row.priceSensitivity,
  buyingPatterns: row.buyingPatterns,
  recommendedCategories: row.recommendedCategories,
  nextBestActions: row.nextBestActions,
  summary: row.summary,
  confidence: row.confidence,
  model: row.model,
  lastAnalyzedAt: row.lastAnalyzedAt,
  lastOrderSeenAt: row.lastOrderSeenAt,
  createdAt: row.createdAt,
});

const mapConversation = (row: typeof aiConversation.$inferSelect): EngagementConversationRow => ({
  id: row.id,
  customerId: row.customerId,
  channel: row.channel,
  status: row.status as AiConversationStatus,
  autopilot: row.autopilot,
  needsHuman: row.needsHuman,
  lastMessageAt: row.lastMessageAt,
  lastOutreachAt: row.lastOutreachAt,
  createdAt: row.createdAt,
});

const mapMessage = (row: typeof aiMessage.$inferSelect): EngagementMessageRow => ({
  id: row.id,
  conversationId: row.conversationId,
  direction: row.direction as AiMessageDirection,
  author: row.author as AiMessageAuthor,
  content: row.content,
  status: row.status as AiMessageStatus,
  intent: row.intent,
  goal: row.goal,
  recommendedProductIds: row.recommendedProductIds,
  waMessageId: row.waMessageId,
  errorMessage: row.errorMessage,
  sentBy: row.sentBy,
  createdAt: row.createdAt,
  sentAt: row.sentAt,
});

const truncate = (value: string, max: number): string => (value.length > max ? `${value.slice(0, max - 3)}...` : value);

const escapeLike = (value: string): string => value.replace(/[%_\\]/g, (match) => `\\${match}`);

const encodeCursor = (cursor: Cursor): string =>
  Buffer.from(JSON.stringify({ createdAt: cursor.createdAt.toISOString(), id: cursor.id })).toString("base64url");

const decodeCursor = (cursor: string | undefined): Cursor | null => {
  if (!cursor) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const value = parsed as { createdAt?: unknown; id?: unknown };
    if (typeof value.createdAt !== "string" || typeof value.id !== "string") {
      return null;
    }
    const createdAt = new Date(value.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return null;
    }
    return { createdAt, id: value.id };
  } catch {
    return null;
  }
};
