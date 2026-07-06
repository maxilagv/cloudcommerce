import { ShippingMethod } from "@cloudcommerce/types";
import { z } from "zod";
import { UuidSchema } from "./common.js";

/** Schemas públicos del storefront: registro/login de clientes y checkout. */

const EmailSchema = z.string().trim().toLowerCase().email().max(254);
const PasswordSchema = z.string().min(8).max(100);
const NameSchema = z.string().trim().min(1).max(80);

export const StoreRegisterSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  firstName: NameSchema,
  lastName: NameSchema,
  whatsapp: z.string().trim().min(6).max(32).optional(),
}).strict();
export type StoreRegisterInput = z.infer<typeof StoreRegisterSchema>;

export const StoreLoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(100),
}).strict();
export type StoreLoginInput = z.infer<typeof StoreLoginSchema>;

export const StoreCheckoutItemSchema = z.object({
  productId: UuidSchema,
  /** Variante puntual; si falta, se resuelve la variante activa por defecto. */
  variantId: UuidSchema.optional(),
  quantity: z.number().int().min(1).max(99),
}).strict();

export const StoreCheckoutAddressSchema = z.object({
  recipientName: z.string().trim().min(1).max(120).optional(),
  province: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(80),
  street: z.string().trim().min(1).max(160),
  streetNumber: z.string().trim().max(20).optional(),
  postalCode: z.string().trim().max(16).optional(),
}).strict();

export const StoreCheckoutSchema = z.object({
  items: z.array(StoreCheckoutItemSchema).min(1).max(30),
  shippingMethod: z.nativeEnum(ShippingMethod).default(ShippingMethod.STANDARD),
  address: StoreCheckoutAddressSchema.optional(),
  notes: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
}).strict().refine(
  (input) => input.shippingMethod === ShippingMethod.PICKUP || Boolean(input.address),
  { message: "El envio a domicilio requiere una direccion." },
);
export type StoreCheckoutInput = z.infer<typeof StoreCheckoutSchema>;

export const StoreMyOrdersSchema = z.object({
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.number().int().min(1).max(50).default(20),
}).strict();
export type StoreMyOrdersInput = z.infer<typeof StoreMyOrdersSchema>;

export const StoreOrderDetailSchema = z.object({
  orderId: UuidSchema,
}).strict();
export type StoreOrderDetailInput = z.infer<typeof StoreOrderDetailSchema>;
