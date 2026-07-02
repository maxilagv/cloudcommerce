import { OrderStatus, ShippingMethod } from "@cloudcommerce/types";
import { z } from "zod";
import { UuidSchema } from "./common.js";

/** Tope de unidades por línea (evita cantidades absurdas; el stock real se valida en checkout). */
export const MAX_QTY_PER_LINE = 20;
/** Tope de líneas distintas por orden/carrito. */
export const MAX_LINES_PER_ORDER = 50;

const QuantitySchema = z.number().int().min(1).max(MAX_QTY_PER_LINE);

// --- Carrito (store; se diseña acá y se activa con el portal de clientes) ----

export const AddCartItemSchema = z.object({
  cartToken: z.string().trim().min(8).max(128).optional(),
  productId: UuidSchema,
  variantId: UuidSchema,
  quantity: QuantitySchema,
});

export const UpdateCartItemSchema = z.object({
  cartToken: z.string().trim().min(8).max(128).optional(),
  itemId: UuidSchema,
  quantity: QuantitySchema,
});

export const RemoveCartItemSchema = z.object({
  cartToken: z.string().trim().min(8).max(128).optional(),
  itemId: UuidSchema,
});

export const GetCartSchema = z.object({
  cartToken: z.string().trim().min(8).max(128).optional(),
});

// --- Órdenes ----------------------------------------------------------------

/**
 * Alta manual de pedido (venta asistida por WhatsApp/teléfono) — headline de la Fase 5.
 * Nunca se acepta ningún `*_minor` ni total desde el cliente: el backend recalcula todo ([06] §Dinero).
 */
export const CreateManualOrderSchema = z.object({
  customerId: UuidSchema,
  shippingMethod: z.nativeEnum(ShippingMethod),
  shippingAddressId: UuidSchema.optional(), // opcional si PICKUP
  lines: z
    .array(
      z.object({
        variantId: UuidSchema,
        quantity: QuantitySchema,
      }),
    )
    .min(1)
    .max(MAX_LINES_PER_ORDER),
  discountCode: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(1000).optional(),
  /** Estado inicial; por defecto el de configuración (`orders.manual_default_status`). */
  initialStatus: z.enum([OrderStatus.CONFIRMED, OrderStatus.PENDING_CONFIRMATION]).optional(),
});

/** Checkout del store (futuro): parte de un carrito ya armado y revalidado. */
export const CheckoutSchema = z.object({
  cartId: UuidSchema,
  shippingAddressId: UuidSchema,
  shippingMethod: z.nativeEnum(ShippingMethod),
  discountCode: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const GetOrderSchema = z.object({
  orderId: UuidSchema,
  /** Motivo de acceso a datos sensibles (requerido para SUPPORT). */
  reason: z.string().trim().min(3).max(300).optional(),
});

export const ListOrdersSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  channel: z.enum(["store", "admin_manual"]).optional(),
  customerId: UuidSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sort: z.enum(["newest", "total-desc", "total-asc"]).default("newest"),
  cursor: z.string().max(512).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const TransitionOrderSchema = z.object({
  orderId: UuidSchema,
  toStatus: z.nativeEnum(OrderStatus),
  reason: z.string().trim().min(1).max(500).optional(),
});

export const CancelOrderSchema = z.object({
  orderId: UuidSchema,
  reason: z.string().trim().min(1).max(500), // motivo OBLIGATORIO
});

// --- Envíos -----------------------------------------------------------------

export const CreateShipmentSchema = z.object({
  orderId: UuidSchema,
  carrier: z.string().trim().max(120).optional(),
  trackingCode: z.string().trim().max(120).optional(),
  eta: z.coerce.date().optional(),
});

export const OrderTrackingSchema = z.object({
  orderId: UuidSchema,
});

export const ShipmentTrackingSchema = z.object({
  shipmentId: UuidSchema,
});

export const RefreshTrackingSchema = z.object({
  shipmentId: UuidSchema,
});

export type AddCartItemInput = z.infer<typeof AddCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;
export type RemoveCartItemInput = z.infer<typeof RemoveCartItemSchema>;
export type GetCartInput = z.infer<typeof GetCartSchema>;
export type CreateManualOrderInput = z.infer<typeof CreateManualOrderSchema>;
export type CheckoutInput = z.infer<typeof CheckoutSchema>;
export type GetOrderInput = z.infer<typeof GetOrderSchema>;
export type ListOrdersInput = z.infer<typeof ListOrdersSchema>;
export type TransitionOrderInput = z.infer<typeof TransitionOrderSchema>;
export type CancelOrderInput = z.infer<typeof CancelOrderSchema>;
export type CreateShipmentInput = z.infer<typeof CreateShipmentSchema>;
export type OrderTrackingInput = z.infer<typeof OrderTrackingSchema>;
export type ShipmentTrackingInput = z.infer<typeof ShipmentTrackingSchema>;
export type RefreshTrackingInput = z.infer<typeof RefreshTrackingSchema>;
