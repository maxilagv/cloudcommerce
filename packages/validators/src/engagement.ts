import { AiConversationStatus } from "@cloudcommerce/types";
import { z } from "zod";
import { UuidSchema } from "./common.js";

const CursorSchema = z.string().trim().min(1).max(512).optional();
const IdempotencyKeySchema = z.string().trim().min(8).max(128).optional();

export const AiOutreachGoalSchema = z.enum([
  "follow_up",
  "cross_sell",
  "win_back",
  "new_arrival",
  "post_purchase",
]);

export const ListAiProfilesSchema = z.object({
  cursor: CursorSchema,
  limit: z.number().int().min(1).max(50).default(20),
  q: z.string().trim().max(120).optional(),
}).strict();
export type ListAiProfilesInput = z.infer<typeof ListAiProfilesSchema>;

export const GetAiProfileSchema = z.object({
  customerId: UuidSchema,
}).strict();
export type GetAiProfileInput = z.infer<typeof GetAiProfileSchema>;

export const AnalyzeCustomerProfileSchema = z.object({
  customerId: UuidSchema,
  idempotencyKey: IdempotencyKeySchema,
}).strict();
export type AnalyzeCustomerProfileInput = z.infer<typeof AnalyzeCustomerProfileSchema>;

export const ListAiConversationsSchema = z.object({
  cursor: CursorSchema,
  limit: z.number().int().min(1).max(50).default(20),
  needsHuman: z.boolean().optional(),
  status: z.nativeEnum(AiConversationStatus).optional(),
}).strict();
export type ListAiConversationsInput = z.infer<typeof ListAiConversationsSchema>;

export const GetAiConversationSchema = z.object({
  conversationId: UuidSchema,
  limit: z.number().int().min(1).max(200).default(100),
}).strict();
export type GetAiConversationInput = z.infer<typeof GetAiConversationSchema>;

export const SendAiMessageSchema = z.object({
  /** Conversación existente o customerId para abrir una nueva. */
  conversationId: UuidSchema.optional(),
  customerId: UuidSchema.optional(),
  content: z.string().trim().min(1).max(1_500),
}).strict().refine((input) => Boolean(input.conversationId) || Boolean(input.customerId), {
  message: "Debe indicarse conversationId o customerId.",
});
export type SendAiMessageInput = z.infer<typeof SendAiMessageSchema>;

export const UpdateAiConversationSchema = z.object({
  conversationId: UuidSchema,
  autopilot: z.boolean().optional(),
  status: z.nativeEnum(AiConversationStatus).optional(),
  needsHuman: z.boolean().optional(),
}).strict();
export type UpdateAiConversationInput = z.infer<typeof UpdateAiConversationSchema>;

export const GenerateOutreachSchema = z.object({
  customerId: UuidSchema,
  goal: AiOutreachGoalSchema.default("follow_up"),
  /** true = además de generar, encolar el envío por WhatsApp. */
  send: z.boolean().default(false),
  idempotencyKey: IdempotencyKeySchema,
}).strict();
export type GenerateOutreachInput = z.infer<typeof GenerateOutreachSchema>;
