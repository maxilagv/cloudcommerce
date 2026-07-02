import { AdminRole } from "@cloudcommerce/types";
import { z } from "zod";
import { ReasonSchema, RequestMetadataSchema, UuidSchema } from "./common.js";

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters long")
  .max(128)
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number");

export const AdminRoleSchema = z.nativeEnum(AdminRole);

export const LoginInputSchema = RequestMetadataSchema.extend({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1).max(128),
  otp: z.string().trim().regex(/^\d{6}$/).optional(),
});

export const RefreshInputSchema = RequestMetadataSchema.extend({
  refreshToken: z.string().min(32).max(512).optional(),
});

export const CreateAdminUserInputSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  fullName: z.string().trim().min(2).max(120),
  role: AdminRoleSchema.exclude([AdminRole.OWNER]),
  password: passwordSchema,
});

export const UpdateAdminRoleInputSchema = z.object({
  userId: UuidSchema,
  role: AdminRoleSchema.exclude([AdminRole.OWNER]),
});

export const RevokeSessionInputSchema = z.object({
  sessionId: UuidSchema,
  reason: ReasonSchema.optional(),
});

export const StartPasswordResetInputSchema = RequestMetadataSchema.extend({
  email: z.string().trim().email().toLowerCase(),
});

export const CompletePasswordResetInputSchema = z.object({
  token: z.string().min(32).max(512),
  newPassword: passwordSchema,
});

export const MfaCodeInputSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
});

export const DisableMfaInputSchema = z.object({
  password: z.string().min(1).max(128),
  code: z.string().trim().regex(/^\d{6}$/),
});

export const AccessReasonInputSchema = z.object({
  resourceType: z.string().trim().min(1).max(80),
  resourceId: UuidSchema,
  action: z.string().trim().min(1).max(80),
  reason: ReasonSchema,
});

export type LoginInput = z.infer<typeof LoginInputSchema>;
export type RefreshInput = z.infer<typeof RefreshInputSchema>;
export type CreateAdminUserInput = z.infer<typeof CreateAdminUserInputSchema>;
export type UpdateAdminRoleInput = z.infer<typeof UpdateAdminRoleInputSchema>;
export type RevokeSessionInput = z.infer<typeof RevokeSessionInputSchema>;
export type StartPasswordResetInput = z.infer<typeof StartPasswordResetInputSchema>;
export type CompletePasswordResetInput = z.infer<typeof CompletePasswordResetInputSchema>;
