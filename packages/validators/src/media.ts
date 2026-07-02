import { z } from "zod";
import { UuidSchema } from "./common.js";

export const MediaIdInputSchema = z.object({
  mediaAssetId: UuidSchema,
});

export const MediaSignedUrlInputSchema = MediaIdInputSchema.extend({
  expiresInSeconds: z.number().int().min(60).max(3_600).default(900),
});

export const UpdateMediaAltTextInputSchema = MediaIdInputSchema.extend({
  altText: z.string().trim().max(160).nullable(),
});

export const AssociateProductMediaInputSchema = z.object({
  productId: UuidSchema,
  mediaAssetId: UuidSchema,
  position: z.number().int().min(0).max(5),
  altText: z.string().trim().max(160).optional().nullable(),
});

export const ReorderProductMediaInputSchema = z.object({
  productId: UuidSchema,
  items: z
    .array(
      z.object({
        mediaAssetId: UuidSchema,
        position: z.number().int().min(0).max(5),
      }),
    )
    .min(1)
    .max(6),
});

export type MediaSignedUrlInput = z.infer<typeof MediaSignedUrlInputSchema>;
export type UpdateMediaAltTextInput = z.infer<typeof UpdateMediaAltTextInputSchema>;
export type AssociateProductMediaInput = z.infer<typeof AssociateProductMediaInputSchema>;
export type ReorderProductMediaInput = z.infer<typeof ReorderProductMediaInputSchema>;
