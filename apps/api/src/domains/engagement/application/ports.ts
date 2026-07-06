import type {
  AiConversationStatus,
  AiMessageAuthor,
  AiMessageDirection,
  AiMessageStatus,
  AiOutreachGoal,
} from "@cloudcommerce/types";
import type { Result } from "../../../shared/domain/result.js";

/**
 * Puertos del dominio engagement (seguimiento IA de clientes + vendedor
 * WhatsApp). El contexto que viaja al servicio IA se construye por whitelist:
 * solo nombre de pila, tier e historial de compras — nunca email, dirección ni
 * teléfono.
 */

export type EngagementUpstreamError =
  | { type: "UPSTREAM_UNAVAILABLE" }
  | { type: "RESPONSE_INVALID" };

export type EngagementUsage = {
  costMinor: number;
  currency: "ARS";
  unit: "tokens" | "image";
  amount: number;
};

export type EngagementPurchaseLine = {
  productTitle: string;
  categoryName: string;
  quantity: number;
  unitPriceMinor: number | null;
  purchasedAt: string | null;
};

/** Vista interna del cliente (incluye whatsapp para envío, que NO viaja a la IA). */
export type EngagementCustomerSnapshot = {
  customerId: string;
  firstName: string;
  displayName: string;
  tier: string;
  whatsapp: string | null;
  locale: string;
  purchases: EngagementPurchaseLine[];
  lastOrderAt: Date | null;
};

/** Snapshot whitelisted que sí viaja al servicio IA. */
export type EngagementCustomerWireSnapshot = {
  customerId: string;
  firstName: string;
  tier: string;
  locale: string;
  purchases: EngagementPurchaseLine[];
  previousProfile: Record<string, unknown> | null;
};

export type EngagementProfilePayload = {
  interests: string[];
  segments: string[];
  priceSensitivity: "low" | "medium" | "high";
  buyingPatterns: string[];
  recommendedCategories: string[];
  nextBestActions: string[];
  summary: string;
  confidence: number;
};

export type EngagementSaleCandidate = {
  productId: string;
  title: string;
  categoryName: string;
  priceMinor: number | null;
  currency: string;
  inStock: boolean;
};

export type EngagementConversationTurn = {
  role: "customer" | "assistant" | "agent";
  content: string;
  sentAt: string | null;
};

export type EngagementReplyIntent =
  | "question"
  | "purchase_intent"
  | "complaint"
  | "smalltalk"
  | "opt_out"
  | "other";

export interface EngagementAiPort {
  analyzeProfile(input: {
    generationId: string;
    requestId: string;
    customer: EngagementCustomerWireSnapshot;
  }): Promise<Result<{ profile: EngagementProfilePayload; model: string; usage: EngagementUsage }, EngagementUpstreamError>>;

  generateOutreach(input: {
    generationId: string;
    requestId: string;
    goal: AiOutreachGoal;
    customer: EngagementCustomerWireSnapshot;
    profile: Record<string, unknown> | null;
    candidates: EngagementSaleCandidate[];
    conversation: EngagementConversationTurn[];
    storeName: string;
  }): Promise<Result<{
    message: string;
    reasoning: string;
    recommendedProductIds: string[];
    shouldSend: boolean;
    model: string;
    usage: EngagementUsage;
  }, EngagementUpstreamError>>;

  generateReply(input: {
    generationId: string;
    requestId: string;
    customer: EngagementCustomerWireSnapshot;
    profile: Record<string, unknown> | null;
    conversation: EngagementConversationTurn[];
    incomingMessage: string;
    candidates: EngagementSaleCandidate[];
    storeName: string;
  }): Promise<Result<{
    message: string;
    intent: EngagementReplyIntent;
    needsHuman: boolean;
    recommendedProductIds: string[];
    model: string;
    usage: EngagementUsage;
  }, EngagementUpstreamError>>;
}

export interface WhatsappPort {
  isConfigured(): boolean;
  sendText(input: {
    to: string;
    text: string;
  }): Promise<Result<{ waMessageId: string }, { type: "UPSTREAM_UNAVAILABLE" } | { type: "SEND_REJECTED"; detail: string }>>;
}

export type EngagementProfileRow = {
  id: string;
  customerId: string;
  interests: string[];
  segments: string[];
  priceSensitivity: string;
  buyingPatterns: string[];
  recommendedCategories: string[];
  nextBestActions: string[];
  summary: string;
  confidence: number;
  model: string;
  lastAnalyzedAt: Date | null;
  lastOrderSeenAt: Date | null;
  createdAt: Date;
};

export type EngagementProfileListRow = EngagementProfileRow & {
  customerName: string;
  tier: string;
  whatsapp: string | null;
};

export type EngagementConversationRow = {
  id: string;
  customerId: string;
  channel: string;
  status: AiConversationStatus;
  autopilot: boolean;
  needsHuman: boolean;
  lastMessageAt: Date | null;
  lastOutreachAt: Date | null;
  createdAt: Date;
};

export type EngagementConversationListRow = EngagementConversationRow & {
  customerName: string;
  whatsapp: string | null;
  lastMessagePreview: string | null;
  lastMessageDirection: AiMessageDirection | null;
};

export type EngagementMessageRow = {
  id: string;
  conversationId: string;
  direction: AiMessageDirection;
  author: AiMessageAuthor;
  content: string;
  status: AiMessageStatus;
  intent: string | null;
  goal: string | null;
  recommendedProductIds: string[];
  waMessageId: string | null;
  errorMessage: string | null;
  sentBy: string | null;
  createdAt: Date;
  sentAt: Date | null;
};

export type UpsertProfileRecord = {
  customerId: string;
  interests: string[];
  segments: string[];
  priceSensitivity: string;
  buyingPatterns: string[];
  recommendedCategories: string[];
  nextBestActions: string[];
  summary: string;
  confidence: number;
  model: string;
  lastAnalyzedAt: Date;
  lastOrderSeenAt: Date | null;
};

export type InsertMessageRecord = {
  id: string;
  conversationId: string;
  direction: AiMessageDirection;
  author: AiMessageAuthor;
  content: string;
  status: AiMessageStatus;
  intent?: string | null;
  goal?: string | null;
  recommendedProductIds?: string[];
  waMessageId?: string | null;
  sentBy?: string | null;
};

export type UpdateConversationRecord = {
  conversationId: string;
  autopilot?: boolean | undefined;
  status?: AiConversationStatus | undefined;
  needsHuman?: boolean | undefined;
  lastMessageAt?: Date | undefined;
  lastOutreachAt?: Date | undefined;
};

export interface EngagementRepository {
  upsertProfile(record: UpsertProfileRecord): Promise<EngagementProfileRow>;
  findProfileByCustomerId(customerId: string): Promise<EngagementProfileRow | null>;
  listProfiles(input: {
    cursor?: string | undefined;
    limit: number;
    q?: string | undefined;
  }): Promise<{ items: EngagementProfileListRow[]; nextCursor: string | null }>;

  ensureConversation(customerId: string, channel: string): Promise<EngagementConversationRow>;
  findConversationById(id: string): Promise<EngagementConversationRow | null>;
  listConversations(input: {
    cursor?: string | undefined;
    limit: number;
    needsHuman?: boolean | undefined;
    status?: AiConversationStatus | undefined;
  }): Promise<{ items: EngagementConversationListRow[]; nextCursor: string | null }>;
  updateConversation(record: UpdateConversationRecord): Promise<EngagementConversationRow | null>;

  insertMessage(record: InsertMessageRecord): Promise<EngagementMessageRow>;
  /** Devuelve los últimos `limit` mensajes en orden ascendente por fecha. */
  listMessages(conversationId: string, limit: number): Promise<EngagementMessageRow[]>;
  findMessageByWaId(waMessageId: string): Promise<EngagementMessageRow | null>;

  findCustomerByWhatsapp(phone: string): Promise<{ id: string } | null>;

  enqueueOutbox(event: {
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
}

export interface EngagementContextReaderPort {
  getCustomerSnapshot(customerId: string): Promise<EngagementCustomerSnapshot | null>;
  /** true si el último consentimiento marketing_whatsapp del cliente fue otorgado. */
  hasWhatsappConsent(customerId: string): Promise<boolean>;
  listSaleCandidates(limit: number): Promise<EngagementSaleCandidate[]>;
}

/** Logger mínimo (compatible con pino) para fallos no fatales del autopilot. */
export interface EngagementLoggerPort {
  warn(context: Record<string, unknown>, message: string): void;
  error(context: Record<string, unknown>, message: string): void;
}
