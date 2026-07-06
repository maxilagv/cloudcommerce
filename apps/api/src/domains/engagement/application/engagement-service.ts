import {
  AiConversationStatus,
  AiMessageAuthor,
  AiMessageDirection,
  AiMessageStatus,
  type Actor,
  type AiConversationDetail,
  type AiConversationListResult,
  type AiConversationSummary,
  type AiMessageRecord,
  type AiOutreachResult,
  type CustomerAiProfileListResult,
  type CustomerAiProfileView,
} from "@cloudcommerce/types";
import type {
  AnalyzeCustomerProfileInput,
  GenerateOutreachInput,
  GetAiConversationInput,
  GetAiProfileInput,
  ListAiConversationsInput,
  ListAiProfilesInput,
  SendAiMessageInput,
  UpdateAiConversationInput,
} from "@cloudcommerce/validators";
import { v7 as uuidv7 } from "uuid";
import { err, ok, type Result } from "../../../shared/domain/result.js";
import type { EngagementDomainError } from "../../../shared/errors/domain-error.js";
import { canUseEngagement } from "../domain/engagement-permissions.js";
import type {
  EngagementAiPort,
  EngagementContextReaderPort,
  EngagementConversationRow,
  EngagementCustomerSnapshot,
  EngagementCustomerWireSnapshot,
  EngagementConversationTurn,
  EngagementLoggerPort,
  EngagementMessageRow,
  EngagementProfileRow,
  EngagementRepository,
  EngagementUpstreamError,
  WhatsappPort,
} from "./ports.js";

const WHATSAPP_CHANNEL = "whatsapp";
const HISTORY_TURNS = 10;
const SALE_CANDIDATES_LIMIT = 12;
const OUTBOX_EVENT_SEND = "engagement.message.send";

export type EngagementServiceOptions = {
  storeName: string;
  outreachCooldownDays: number;
};

export type InboundWhatsappInput = {
  from: string;
  text: string;
  waMessageId: string;
  timestamp: string;
};

export class EngagementService {
  public constructor(
    private readonly ai: EngagementAiPort,
    private readonly whatsapp: WhatsappPort,
    private readonly repository: EngagementRepository,
    private readonly contextReader: EngagementContextReaderPort,
    private readonly options: EngagementServiceOptions,
    private readonly logger: EngagementLoggerPort,
  ) {}

  public async analyzeCustomer(
    actor: Actor,
    input: AnalyzeCustomerProfileInput,
    requestId: string,
  ): Promise<Result<CustomerAiProfileView, EngagementDomainError>> {
    const guard = this.guard(actor);
    if (guard) return err(guard);
    const snapshot = await this.contextReader.getCustomerSnapshot(input.customerId);
    if (!snapshot) {
      return err({ type: "CUSTOMER_NOT_FOUND" });
    }
    const analyzed = await this.analyzeSnapshot(snapshot, requestId);
    if (!analyzed.ok) return analyzed;
    return ok(presentProfile(analyzed.value, snapshot));
  }

  public async getProfile(
    actor: Actor,
    input: GetAiProfileInput,
  ): Promise<Result<CustomerAiProfileView, EngagementDomainError>> {
    const guard = this.guard(actor);
    if (guard) return err(guard);
    const snapshot = await this.contextReader.getCustomerSnapshot(input.customerId);
    if (!snapshot) {
      return err({ type: "CUSTOMER_NOT_FOUND" });
    }
    const profile = await this.repository.findProfileByCustomerId(input.customerId);
    if (!profile) {
      return err({ type: "PROFILE_NOT_FOUND" });
    }
    return ok(presentProfile(profile, snapshot));
  }

  public async listProfiles(
    actor: Actor,
    input: ListAiProfilesInput,
  ): Promise<Result<CustomerAiProfileListResult, EngagementDomainError>> {
    const guard = this.guard(actor);
    if (guard) return err(guard);
    const page = await this.repository.listProfiles({
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
      limit: input.limit,
      ...(input.q !== undefined ? { q: input.q } : {}),
    });
    return ok({
      items: page.items.map((row) =>
        presentProfileRow(row, { customerName: row.customerName, tier: row.tier, whatsapp: row.whatsapp }),
      ),
      nextCursor: page.nextCursor,
    });
  }

  public async listConversations(
    actor: Actor,
    input: ListAiConversationsInput,
  ): Promise<Result<AiConversationListResult, EngagementDomainError>> {
    const guard = this.guard(actor);
    if (guard) return err(guard);
    const page = await this.repository.listConversations({
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
      limit: input.limit,
      ...(input.needsHuman !== undefined ? { needsHuman: input.needsHuman } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    });
    return ok({
      items: page.items.map((row) =>
        presentConversation(row, {
          customerName: row.customerName,
          whatsapp: row.whatsapp,
          lastMessagePreview: row.lastMessagePreview,
          lastMessageDirection: row.lastMessageDirection,
        }),
      ),
      nextCursor: page.nextCursor,
    });
  }

  public async getConversation(
    actor: Actor,
    input: GetAiConversationInput,
  ): Promise<Result<AiConversationDetail, EngagementDomainError>> {
    const guard = this.guard(actor);
    if (guard) return err(guard);
    const conversation = await this.repository.findConversationById(input.conversationId);
    if (!conversation) {
      return err({ type: "CONVERSATION_NOT_FOUND" });
    }
    const snapshot = await this.contextReader.getCustomerSnapshot(conversation.customerId);
    const messages = await this.repository.listMessages(conversation.id, input.limit);
    const profile = await this.repository.findProfileByCustomerId(conversation.customerId);
    const last = messages[messages.length - 1] ?? null;
    return ok({
      conversation: presentConversation(conversation, {
        customerName: snapshot?.displayName ?? "",
        whatsapp: snapshot?.whatsapp ?? null,
        lastMessagePreview: last ? preview(last.content) : null,
        lastMessageDirection: last ? last.direction : null,
      }),
      messages: messages.map(presentMessage),
      profile:
        profile && snapshot
          ? presentProfile(profile, snapshot)
          : null,
    });
  }

  public async sendManualMessage(
    actor: Actor,
    input: SendAiMessageInput,
  ): Promise<Result<AiMessageRecord, EngagementDomainError>> {
    const guard = this.guard(actor);
    if (guard) return err(guard);
    let conversation: EngagementConversationRow | null = null;
    if (input.conversationId) {
      conversation = await this.repository.findConversationById(input.conversationId);
      if (!conversation) {
        return err({ type: "CONVERSATION_NOT_FOUND" });
      }
    } else if (input.customerId) {
      const snapshot = await this.contextReader.getCustomerSnapshot(input.customerId);
      if (!snapshot) {
        return err({ type: "CUSTOMER_NOT_FOUND" });
      }
      if (!snapshot.whatsapp) {
        return err({ type: "WHATSAPP_NOT_AVAILABLE" });
      }
      conversation = await this.repository.ensureConversation(input.customerId, WHATSAPP_CHANNEL);
    }
    if (!conversation) {
      return err({ type: "CONVERSATION_NOT_FOUND" });
    }
    const snapshot = await this.contextReader.getCustomerSnapshot(conversation.customerId);
    if (!snapshot?.whatsapp) {
      return err({ type: "WHATSAPP_NOT_AVAILABLE" });
    }
    const message = await this.repository.insertMessage({
      id: uuidv7(),
      conversationId: conversation.id,
      direction: AiMessageDirection.OUT,
      author: AiMessageAuthor.ADMIN,
      content: input.content,
      status: AiMessageStatus.PENDING,
      sentBy: actor.kind === "admin" ? actor.userId : null,
    });
    await this.enqueueSend(message.id);
    await this.repository.updateConversation({ conversationId: conversation.id, lastMessageAt: new Date() });
    return ok(presentMessage(message));
  }

  public async updateConversation(
    actor: Actor,
    input: UpdateAiConversationInput,
  ): Promise<Result<AiConversationSummary, EngagementDomainError>> {
    const guard = this.guard(actor);
    if (guard) return err(guard);
    const updated = await this.repository.updateConversation({
      conversationId: input.conversationId,
      ...(input.autopilot !== undefined ? { autopilot: input.autopilot } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.needsHuman !== undefined ? { needsHuman: input.needsHuman } : {}),
    });
    if (!updated) {
      return err({ type: "CONVERSATION_NOT_FOUND" });
    }
    const snapshot = await this.contextReader.getCustomerSnapshot(updated.customerId);
    const [last] = await this.repository.listMessages(updated.id, 1);
    return ok(
      presentConversation(updated, {
        customerName: snapshot?.displayName ?? "",
        whatsapp: snapshot?.whatsapp ?? null,
        lastMessagePreview: last ? preview(last.content) : null,
        lastMessageDirection: last ? last.direction : null,
      }),
    );
  }

  public async generateOutreach(
    actor: Actor,
    input: GenerateOutreachInput,
    requestId: string,
  ): Promise<Result<AiOutreachResult, EngagementDomainError>> {
    const guard = this.guard(actor);
    if (guard) return err(guard);
    const snapshot = await this.contextReader.getCustomerSnapshot(input.customerId);
    if (!snapshot) {
      return err({ type: "CUSTOMER_NOT_FOUND" });
    }
    const hasConsent = await this.contextReader.hasWhatsappConsent(input.customerId);
    if (!hasConsent) {
      return err({ type: "NO_CONSENT" });
    }
    let profile = await this.repository.findProfileByCustomerId(input.customerId);
    if (!profile) {
      // Sin perfil previo: se analiza al vuelo antes de generar el outreach.
      const analyzed = await this.analyzeSnapshot(snapshot, requestId);
      if (!analyzed.ok) return analyzed;
      profile = analyzed.value;
    }
    const conversation = await this.repository.ensureConversation(input.customerId, WHATSAPP_CHANNEL);
    const history = await this.repository.listMessages(conversation.id, HISTORY_TURNS);
    const candidates = await this.contextReader.listSaleCandidates(SALE_CANDIDATES_LIMIT);
    const result = await this.ai.generateOutreach({
      generationId: uuidv7(),
      requestId,
      goal: input.goal,
      customer: toWireSnapshot(snapshot, profile),
      profile: profileWirePayload(profile),
      candidates,
      conversation: toTurns(history),
      storeName: this.options.storeName,
    });
    if (!result.ok) {
      return err(mapUpstream(result.error));
    }
    let queued = false;
    let messageId: string | null = null;
    if (input.send && result.value.shouldSend && this.whatsapp.isConfigured() && snapshot.whatsapp) {
      const message = await this.repository.insertMessage({
        id: uuidv7(),
        conversationId: conversation.id,
        direction: AiMessageDirection.OUT,
        author: AiMessageAuthor.AI,
        content: result.value.message,
        status: AiMessageStatus.PENDING,
        goal: input.goal,
        recommendedProductIds: result.value.recommendedProductIds,
      });
      await this.enqueueSend(message.id);
      const now = new Date();
      await this.repository.updateConversation({
        conversationId: conversation.id,
        lastMessageAt: now,
        lastOutreachAt: now,
      });
      queued = true;
      messageId = message.id;
    }
    return ok({
      message: result.value.message,
      reasoning: result.value.reasoning,
      recommendedProductIds: result.value.recommendedProductIds,
      shouldSend: result.value.shouldSend,
      queued,
      messageId,
    });
  }

  /**
   * Entrada de WhatsApp (webhook de Meta). Nunca lanza por fallos de IA: ante
   * cualquier problema deja la conversación marcada para atención humana.
   */
  public async handleInboundWhatsapp(input: InboundWhatsappInput): Promise<Result<{ handled: boolean }, EngagementDomainError>> {
    const duplicate = await this.repository.findMessageByWaId(input.waMessageId);
    if (duplicate) {
      return ok({ handled: false });
    }
    const digits = normalizePhone(input.from);
    if (digits.length === 0) {
      return ok({ handled: false });
    }
    const customer = await this.repository.findCustomerByWhatsapp(digits);
    if (!customer) {
      // Número desconocido: se ignora sin error para no filtrar información.
      return ok({ handled: false });
    }
    const conversation = await this.repository.ensureConversation(customer.id, WHATSAPP_CHANNEL);
    await this.repository.insertMessage({
      id: uuidv7(),
      conversationId: conversation.id,
      direction: AiMessageDirection.IN,
      author: AiMessageAuthor.CUSTOMER,
      content: input.text,
      status: AiMessageStatus.RECEIVED,
      waMessageId: input.waMessageId,
    });
    await this.repository.updateConversation({ conversationId: conversation.id, lastMessageAt: new Date() });

    if (!conversation.autopilot || conversation.status !== AiConversationStatus.ACTIVE) {
      return ok({ handled: true });
    }

    const snapshot = await this.contextReader.getCustomerSnapshot(customer.id);
    if (!snapshot) {
      return ok({ handled: true });
    }
    const profile = await this.repository.findProfileByCustomerId(customer.id);
    const candidates = await this.contextReader.listSaleCandidates(SALE_CANDIDATES_LIMIT);
    const history = await this.repository.listMessages(conversation.id, HISTORY_TURNS);
    const reply = await this.ai.generateReply({
      generationId: uuidv7(),
      requestId: `wa-${input.waMessageId}`,
      customer: toWireSnapshot(snapshot, profile),
      profile: profile ? profileWirePayload(profile) : null,
      conversation: toTurns(history),
      incomingMessage: input.text,
      candidates,
      storeName: this.options.storeName,
    });
    if (!reply.ok) {
      this.logger.warn(
        { conversationId: conversation.id, error: reply.error.type },
        "engagement: fallo la respuesta IA; se deriva a humano",
      );
      await this.repository.updateConversation({ conversationId: conversation.id, needsHuman: true });
      return ok({ handled: true });
    }
    if (reply.value.intent === "opt_out") {
      // Baja solicitada: se pausa el autopilot pero se confirma cortésmente.
      await this.repository.updateConversation({
        conversationId: conversation.id,
        autopilot: false,
        status: AiConversationStatus.PAUSED,
      });
    } else if (reply.value.needsHuman) {
      await this.repository.updateConversation({ conversationId: conversation.id, needsHuman: true });
    }
    const outbound = await this.repository.insertMessage({
      id: uuidv7(),
      conversationId: conversation.id,
      direction: AiMessageDirection.OUT,
      author: AiMessageAuthor.AI,
      content: reply.value.message,
      status: AiMessageStatus.PENDING,
      intent: reply.value.intent,
      recommendedProductIds: reply.value.recommendedProductIds,
    });
    await this.enqueueSend(outbound.id);
    await this.repository.updateConversation({ conversationId: conversation.id, lastMessageAt: new Date() });
    return ok({ handled: true });
  }

  /** Analiza el snapshot contra el servicio IA y persiste el perfil. */
  private async analyzeSnapshot(
    snapshot: EngagementCustomerSnapshot,
    requestId: string,
  ): Promise<Result<EngagementProfileRow, EngagementDomainError>> {
    const previous = await this.repository.findProfileByCustomerId(snapshot.customerId);
    const result = await this.ai.analyzeProfile({
      generationId: uuidv7(),
      requestId,
      customer: toWireSnapshot(snapshot, previous),
    });
    if (!result.ok) {
      return err(mapUpstream(result.error));
    }
    const stored = await this.repository.upsertProfile({
      customerId: snapshot.customerId,
      interests: result.value.profile.interests,
      segments: result.value.profile.segments,
      priceSensitivity: result.value.profile.priceSensitivity,
      buyingPatterns: result.value.profile.buyingPatterns,
      recommendedCategories: result.value.profile.recommendedCategories,
      nextBestActions: result.value.profile.nextBestActions,
      summary: result.value.profile.summary,
      confidence: result.value.profile.confidence,
      model: result.value.model,
      lastAnalyzedAt: new Date(),
      lastOrderSeenAt: snapshot.lastOrderAt,
    });
    return ok(stored);
  }

  private async enqueueSend(messageId: string): Promise<void> {
    await this.repository.enqueueOutbox({
      id: uuidv7(),
      aggregateType: "ai_message",
      aggregateId: messageId,
      eventType: OUTBOX_EVENT_SEND,
      payload: { messageId },
    });
  }

  private guard(actor: Actor): EngagementDomainError | null {
    if (canUseEngagement(actor)) {
      return null;
    }
    return actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" };
  }
}

const mapUpstream = (error: EngagementUpstreamError): EngagementDomainError =>
  error.type === "UPSTREAM_UNAVAILABLE" ? { type: "AI_UPSTREAM_UNAVAILABLE" } : { type: "AI_RESPONSE_INVALID" };

const normalizePhone = (value: string): string => value.replace(/\D/g, "");

const preview = (content: string): string => (content.length > 160 ? `${content.slice(0, 157)}...` : content);

const toWireSnapshot = (
  snapshot: EngagementCustomerSnapshot,
  previous: EngagementProfileRow | null,
): EngagementCustomerWireSnapshot => ({
  customerId: snapshot.customerId,
  firstName: snapshot.firstName,
  tier: snapshot.tier,
  locale: snapshot.locale,
  purchases: snapshot.purchases,
  previousProfile: previous ? profileWirePayload(previous) : null,
});

const profileWirePayload = (profile: EngagementProfileRow): Record<string, unknown> => ({
  interests: profile.interests,
  segments: profile.segments,
  priceSensitivity: profile.priceSensitivity,
  buyingPatterns: profile.buyingPatterns,
  recommendedCategories: profile.recommendedCategories,
  nextBestActions: profile.nextBestActions,
  summary: profile.summary,
  confidence: profile.confidence,
});

const toTurns = (messages: EngagementMessageRow[]): EngagementConversationTurn[] =>
  messages.map((message) => ({
    role: message.direction === AiMessageDirection.IN ? "customer" : message.author === AiMessageAuthor.ADMIN ? "agent" : "assistant",
    content: message.content,
    sentAt: (message.sentAt ?? message.createdAt).toISOString(),
  }));

const sensitivity = (value: string): "low" | "medium" | "high" =>
  value === "low" || value === "high" ? value : "medium";

const presentProfileRow = (
  profile: EngagementProfileRow,
  customer: { customerName: string; tier: string; whatsapp: string | null },
): CustomerAiProfileView => ({
  customerId: profile.customerId,
  customerName: customer.customerName,
  tier: customer.tier,
  whatsapp: customer.whatsapp,
  interests: profile.interests,
  segments: profile.segments,
  priceSensitivity: sensitivity(profile.priceSensitivity),
  buyingPatterns: profile.buyingPatterns,
  recommendedCategories: profile.recommendedCategories,
  nextBestActions: profile.nextBestActions,
  summary: profile.summary,
  confidence: profile.confidence,
  model: profile.model,
  lastAnalyzedAt: profile.lastAnalyzedAt?.toISOString() ?? null,
});

const presentProfile = (profile: EngagementProfileRow, snapshot: EngagementCustomerSnapshot): CustomerAiProfileView =>
  presentProfileRow(profile, { customerName: snapshot.displayName, tier: snapshot.tier, whatsapp: snapshot.whatsapp });

const presentConversation = (
  conversation: EngagementConversationRow,
  extra: {
    customerName: string;
    whatsapp: string | null;
    lastMessagePreview: string | null;
    lastMessageDirection: AiMessageDirection | null;
  },
): AiConversationSummary => ({
  id: conversation.id,
  customerId: conversation.customerId,
  customerName: extra.customerName,
  whatsapp: extra.whatsapp,
  channel: conversation.channel,
  status: conversation.status,
  autopilot: conversation.autopilot,
  needsHuman: conversation.needsHuman,
  lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
  lastMessagePreview: extra.lastMessagePreview,
  lastMessageDirection: extra.lastMessageDirection,
  createdAt: conversation.createdAt.toISOString(),
});

const presentMessage = (message: EngagementMessageRow): AiMessageRecord => ({
  id: message.id,
  conversationId: message.conversationId,
  direction: message.direction,
  author: message.author,
  content: message.content,
  status: message.status,
  intent: message.intent,
  goal: message.goal,
  recommendedProductIds: message.recommendedProductIds,
  errorMessage: message.errorMessage,
  createdAt: message.createdAt.toISOString(),
  sentAt: message.sentAt?.toISOString() ?? null,
});
