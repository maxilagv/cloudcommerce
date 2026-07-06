import {
  AdminRole,
  AiConversationStatus,
  AiMessageAuthor,
  AiMessageDirection,
  AiMessageStatus,
  type Actor,
} from "@cloudcommerce/types";
import { describe, expect, it } from "vitest";
import { EngagementService } from "../../application/engagement-service.js";
import type {
  EngagementAiPort,
  EngagementContextReaderPort,
  EngagementConversationRow,
  EngagementCustomerSnapshot,
  EngagementMessageRow,
  EngagementProfileRow,
  EngagementRepository,
  InsertMessageRecord,
  UpdateConversationRecord,
  UpsertProfileRecord,
  WhatsappPort,
} from "../../application/ports.js";

const owner: Actor = { kind: "admin", userId: "018f0000-0000-7000-8000-000000000001", role: AdminRole.OWNER, sessionId: "s1" };
const support: Actor = { kind: "admin", userId: "018f0000-0000-7000-8000-000000000002", role: AdminRole.SUPPORT, sessionId: "s2" };

const customerId = "018f0000-0000-7000-8000-00000000aaaa";

const snapshot: EngagementCustomerSnapshot = {
  customerId,
  firstName: "Maxi",
  displayName: "Maxi Lavagetto",
  tier: "CloudBase",
  whatsapp: "+54 9 11 5555-0000",
  locale: "es-AR",
  purchases: [],
  lastOrderAt: null,
};

const usage = { costMinor: 100, currency: "ARS" as const, unit: "tokens" as const, amount: 500 };

const profilePayload = {
  interests: ["lavarropas"],
  segments: ["hogar"],
  priceSensitivity: "medium" as const,
  buyingPatterns: [],
  recommendedCategories: [],
  nextBestActions: [],
  summary: "Cliente de hogar",
  confidence: 60,
};

class FakeAi implements EngagementAiPort {
  public outreachCalls = 0;

  public async analyzeProfile(): ReturnType<EngagementAiPort["analyzeProfile"]> {
    return { ok: true, value: { profile: profilePayload, model: "gpt", usage } };
  }

  public async generateOutreach(): ReturnType<EngagementAiPort["generateOutreach"]> {
    this.outreachCalls += 1;
    return {
      ok: true,
      value: { message: "Hola Maxi!", reasoning: "seguimiento", recommendedProductIds: [], shouldSend: true, model: "gpt", usage },
    };
  }

  public async generateReply(): ReturnType<EngagementAiPort["generateReply"]> {
    return {
      ok: true,
      value: { message: "Gracias!", intent: "smalltalk", needsHuman: false, recommendedProductIds: [], model: "gpt", usage },
    };
  }
}

class FakeWhatsapp implements WhatsappPort {
  public isConfigured(): boolean {
    return true;
  }

  public async sendText(): ReturnType<WhatsappPort["sendText"]> {
    return { ok: true, value: { waMessageId: "wamid.1" } };
  }
}

class FakeRepository implements EngagementRepository {
  public profiles = new Map<string, EngagementProfileRow>();
  public messages: EngagementMessageRow[] = [];
  public outbox: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  private conversation: EngagementConversationRow = {
    id: "018f0000-0000-7000-8000-00000000cccc",
    customerId,
    channel: "whatsapp",
    status: AiConversationStatus.ACTIVE,
    autopilot: true,
    needsHuman: false,
    lastMessageAt: null,
    lastOutreachAt: null,
    createdAt: new Date("2026-07-01T00:00:00Z"),
  };

  public async upsertProfile(record: UpsertProfileRecord): Promise<EngagementProfileRow> {
    const row: EngagementProfileRow = {
      id: "018f0000-0000-7000-8000-00000000dddd",
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
      createdAt: new Date("2026-07-01T00:00:00Z"),
    };
    this.profiles.set(record.customerId, row);
    return row;
  }

  public async findProfileByCustomerId(id: string): Promise<EngagementProfileRow | null> {
    return this.profiles.get(id) ?? null;
  }

  public async listProfiles(): ReturnType<EngagementRepository["listProfiles"]> {
    return { items: [], nextCursor: null };
  }

  public async ensureConversation(): Promise<EngagementConversationRow> {
    return this.conversation;
  }

  public async findConversationById(id: string): Promise<EngagementConversationRow | null> {
    return id === this.conversation.id ? this.conversation : null;
  }

  public async listConversations(): ReturnType<EngagementRepository["listConversations"]> {
    return { items: [], nextCursor: null };
  }

  public async updateConversation(record: UpdateConversationRecord): Promise<EngagementConversationRow | null> {
    this.conversation = {
      ...this.conversation,
      ...(record.autopilot !== undefined ? { autopilot: record.autopilot } : {}),
      ...(record.status !== undefined ? { status: record.status } : {}),
      ...(record.needsHuman !== undefined ? { needsHuman: record.needsHuman } : {}),
      ...(record.lastMessageAt !== undefined ? { lastMessageAt: record.lastMessageAt } : {}),
      ...(record.lastOutreachAt !== undefined ? { lastOutreachAt: record.lastOutreachAt } : {}),
    };
    return this.conversation;
  }

  public async insertMessage(record: InsertMessageRecord): Promise<EngagementMessageRow> {
    const row: EngagementMessageRow = {
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
      errorMessage: null,
      sentBy: record.sentBy ?? null,
      createdAt: new Date(),
      sentAt: null,
    };
    this.messages.push(row);
    return row;
  }

  public async listMessages(): Promise<EngagementMessageRow[]> {
    return this.messages;
  }

  public async findMessageByWaId(): Promise<EngagementMessageRow | null> {
    return null;
  }

  public async findCustomerByWhatsapp(): Promise<{ id: string } | null> {
    return { id: customerId };
  }

  public async enqueueOutbox(event: { eventType: string; payload: Record<string, unknown> }): Promise<void> {
    this.outbox.push({ eventType: event.eventType, payload: event.payload });
  }
}

class FakeContextReader implements EngagementContextReaderPort {
  public constructor(private readonly consent: boolean) {}

  public async getCustomerSnapshot(): Promise<EngagementCustomerSnapshot | null> {
    return snapshot;
  }

  public async hasWhatsappConsent(): Promise<boolean> {
    return this.consent;
  }

  public async listSaleCandidates(): ReturnType<EngagementContextReaderPort["listSaleCandidates"]> {
    return [];
  }
}

const silentLogger = { warn: () => undefined, error: () => undefined };

const buildService = (consent: boolean, repository = new FakeRepository(), ai = new FakeAi()) =>
  new EngagementService(ai, new FakeWhatsapp(), repository, new FakeContextReader(consent), {
    storeName: "CloudCommerce",
    outreachCooldownDays: 7,
  }, silentLogger);

describe("EngagementService.generateOutreach", () => {
  it("rechaza el outreach sin consentimiento marketing_whatsapp", async () => {
    const ai = new FakeAi();
    const service = buildService(false, new FakeRepository(), ai);
    const result = await service.generateOutreach(owner, { customerId, goal: "follow_up", send: true }, "req-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("NO_CONSENT");
    }
    expect(ai.outreachCalls).toBe(0);
  });

  it("con consentimiento genera, encola el envio y marca queued", async () => {
    const repository = new FakeRepository();
    const service = buildService(true, repository);
    const result = await service.generateOutreach(owner, { customerId, goal: "follow_up", send: true }, "req-2");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.queued).toBe(true);
      expect(result.value.messageId).not.toBeNull();
    }
    expect(repository.outbox).toHaveLength(1);
    expect(repository.outbox[0]?.eventType).toBe("engagement.message.send");
    const [message] = repository.messages;
    expect(message?.direction).toBe(AiMessageDirection.OUT);
    expect(message?.author).toBe(AiMessageAuthor.AI);
    expect(message?.status).toBe(AiMessageStatus.PENDING);
  });

  it("rechaza a un admin sin rol OWNER/ADMIN", async () => {
    const service = buildService(true);
    const result = await service.generateOutreach(support, { customerId, goal: "follow_up", send: false }, "req-3");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("FORBIDDEN");
    }
  });
});
