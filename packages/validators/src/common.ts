import { z } from "zod";

export const UuidSchema = z.string().uuid();

export const RequestMetadataSchema = z.object({
  deviceFingerprint: z.string().trim().min(8).max(256).optional(),
});

export const ReasonSchema = z.string().trim().min(3).max(500);
