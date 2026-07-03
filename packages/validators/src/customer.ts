import { CustomerContactChannel, CustomerContactDirection } from "@cloudcommerce/types";
import { z } from "zod";
import { ReasonSchema, UuidSchema } from "./common.js";

const CustomerNameSchema = z.string().trim().min(1).max(80);
const OptionalTrimmedSchema = (max: number) => z.string().trim().min(1).max(max).optional();
const OptionalNullableTrimmedSchema = (max: number) => z.string().trim().min(1).max(max).optional().nullable();

export const CreateCustomerSchema = z.object({
  firstName: CustomerNameSchema,
  lastName: CustomerNameSchema,
  whatsapp: z.string().trim().regex(/^\+?\d{8,15}$/).optional(),
  email: z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
  notes: z.string().trim().max(1_000).optional(),
}).strict();

export const CustomerAddressSchema = z.object({
  province: z.string().trim().min(1).max(60),
  city: z.string().trim().min(1).max(80),
  street: z.string().trim().min(1).max(120),
  streetNumber: OptionalTrimmedSchema(20),
  betweenStreets: OptionalTrimmedSchema(160),
  postalCode: z.string().trim().regex(/^\d{4,8}$/).optional(),
  isPrimary: z.boolean().default(false),
}).strict();

export const CreateCustomerInputSchema = CreateCustomerSchema.extend({
  initialAddress: CustomerAddressSchema.optional(),
  reason: ReasonSchema.optional(),
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial()
  .extend({
    customerId: UuidSchema,
    reason: ReasonSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.firstName === undefined &&
      value.lastName === undefined &&
      value.whatsapp === undefined &&
      value.email === undefined &&
      value.notes === undefined
    ) {
      ctx.addIssue({ code: "custom", message: "At least one customer field is required" });
    }
  });

export const AddCustomerAddressSchema = CustomerAddressSchema.extend({
  customerId: UuidSchema,
  label: OptionalNullableTrimmedSchema(60),
  recipientName: OptionalNullableTrimmedSchema(160),
  reason: ReasonSchema.optional(),
});

export const UpdateCustomerAddressSchema = CustomerAddressSchema.partial()
  .extend({
    customerId: UuidSchema,
    addressId: UuidSchema,
    label: OptionalNullableTrimmedSchema(60),
    recipientName: OptionalNullableTrimmedSchema(160),
    reason: ReasonSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const hasAddressField =
      value.province !== undefined ||
      value.city !== undefined ||
      value.street !== undefined ||
      value.streetNumber !== undefined ||
      value.betweenStreets !== undefined ||
      value.postalCode !== undefined ||
      value.isPrimary !== undefined ||
      value.label !== undefined ||
      value.recipientName !== undefined;
    if (!hasAddressField) {
      ctx.addIssue({ code: "custom", message: "At least one address field is required" });
    }
  });

export const SetPrimaryCustomerAddressSchema = z.object({
  customerId: UuidSchema,
  addressId: UuidSchema,
  reason: ReasonSchema.optional(),
}).strict();

export const LogCustomerContactSchema = z
  .object({
    customerId: UuidSchema,
    channel: z.nativeEnum(CustomerContactChannel),
    direction: z.nativeEnum(CustomerContactDirection).default(CustomerContactDirection.IN),
    note: z.string().trim().max(500).optional(),
    occurredAt: z.coerce.date().default(() => new Date()),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.occurredAt.getTime() > Date.now() + 1_000) {
      ctx.addIssue({ code: "custom", path: ["occurredAt"], message: "occurredAt cannot be in the future" });
    }
  });

export const SearchCustomersSchema = z.object({
  q: z.string().trim().max(80).optional(),
  sort: z.enum(["recent", "name", "last_contact"]).default("recent"),
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.number().int().min(1).max(50).default(20),
}).strict();

export const CustomerIdInputSchema = z.object({
  customerId: UuidSchema,
}).strict();

export const GetCustomerDetailSchema = CustomerIdInputSchema.extend({
  reason: ReasonSchema.optional(),
});

export const GetCustomerAnalyticsSchema = CustomerIdInputSchema.extend({
  range: z.enum(["3M", "6M", "12M"]).default("6M"),
  breakdown: z.enum(["category", "spend"]).default("category"),
});

export const ListCustomerContactsSchema = CustomerIdInputSchema.extend({
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  reason: ReasonSchema.optional(),
});

export const SoftDeleteCustomerSchema = CustomerIdInputSchema.extend({
  reason: ReasonSchema,
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerInputSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
export type CustomerAddressInput = z.infer<typeof CustomerAddressSchema>;
export type AddCustomerAddressInput = z.infer<typeof AddCustomerAddressSchema>;
export type UpdateCustomerAddressInput = z.infer<typeof UpdateCustomerAddressSchema>;
export type SetPrimaryCustomerAddressInput = z.infer<typeof SetPrimaryCustomerAddressSchema>;
export type LogCustomerContactInput = z.infer<typeof LogCustomerContactSchema>;
export type SearchCustomersInput = z.infer<typeof SearchCustomersSchema>;
export type GetCustomerDetailInput = z.infer<typeof GetCustomerDetailSchema>;
export type GetCustomerAnalyticsInput = z.infer<typeof GetCustomerAnalyticsSchema>;
export type ListCustomerContactsInput = z.infer<typeof ListCustomerContactsSchema>;
export type SoftDeleteCustomerInput = z.infer<typeof SoftDeleteCustomerSchema>;
