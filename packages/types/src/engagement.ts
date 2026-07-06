/** Seguimiento inteligente de clientes (perfiles IA + vendedor WhatsApp). */

export enum AiConversationStatus {
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  CLOSED = "CLOSED",
}

export enum AiMessageDirection {
  IN = "IN",
  OUT = "OUT",
}

export enum AiMessageStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  DELIVERED = "DELIVERED",
  READ = "READ",
  FAILED = "FAILED",
  RECEIVED = "RECEIVED",
}

export enum AiMessageAuthor {
  CUSTOMER = "CUSTOMER",
  AI = "AI",
  ADMIN = "ADMIN",
}

export type AiOutreachGoal = "follow_up" | "cross_sell" | "win_back" | "new_arrival" | "post_purchase";

export type CustomerAiProfileView = {
  customerId: string;
  customerName: string;
  tier: string;
  whatsapp: string | null;
  interests: string[];
  segments: string[];
  priceSensitivity: "low" | "medium" | "high";
  buyingPatterns: string[];
  recommendedCategories: string[];
  nextBestActions: string[];
  summary: string;
  confidence: number;
  model: string;
  lastAnalyzedAt: string | null;
};

export type CustomerAiProfileListResult = {
  items: CustomerAiProfileView[];
  nextCursor: string | null;
};

export type AiConversationSummary = {
  id: string;
  customerId: string;
  customerName: string;
  whatsapp: string | null;
  channel: string;
  status: AiConversationStatus;
  autopilot: boolean;
  needsHuman: boolean;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageDirection: AiMessageDirection | null;
  createdAt: string;
};

export type AiConversationListResult = {
  items: AiConversationSummary[];
  nextCursor: string | null;
};

export type AiMessageRecord = {
  id: string;
  conversationId: string;
  direction: AiMessageDirection;
  author: AiMessageAuthor;
  content: string;
  status: AiMessageStatus;
  intent: string | null;
  goal: string | null;
  recommendedProductIds: string[];
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
};

export type AiConversationDetail = {
  conversation: AiConversationSummary;
  messages: AiMessageRecord[];
  profile: CustomerAiProfileView | null;
};

export type AiOutreachResult = {
  message: string;
  reasoning: string;
  recommendedProductIds: string[];
  shouldSend: boolean;
  /** true si el mensaje quedó encolado para envío por WhatsApp. */
  queued: boolean;
  messageId: string | null;
};
