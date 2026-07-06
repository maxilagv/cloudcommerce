import type { CustomerTier } from "@cloudcommerce/types";

/**
 * Puertos del dominio storefront: cuentas de cliente + sesiones de la tienda
 * pública. El checkout y "mis pedidos" reutilizan el OrderRepository y el
 * OrderPricingPort del dominio orders.
 */

export type CustomerAccountRow = {
  id: string;
  customerId: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
};

export type CustomerProfileRow = {
  customerId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  tier: CustomerTier;
  whatsapp: string | null;
};

export type CreateAccountRecord = {
  accountId: string;
  /** Cliente CRM existente a vincular; null crea uno nuevo. */
  customerId: string | null;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  whatsapp: string | null;
};

export type CreateSessionRecord = {
  id: string;
  accountId: string;
  sessionTokenHash: string;
  ip: string;
  userAgent: string;
  expiresAt: Date;
};

export type ActiveSessionRow = {
  sessionId: string;
  accountId: string;
  customerId: string;
  accountActive: boolean;
  expiresAt: Date;
};

export type CreateStoreAddressRecord = {
  customerId: string;
  recipientName: string | null;
  province: string;
  city: string;
  street: string;
  streetNumber: string | null;
  postalCode: string | null;
};

export interface StorefrontRepository {
  findAccountByEmail(email: string): Promise<CustomerAccountRow | null>;
  /** Cliente CRM activo con ese email pero sin cuenta (para vincular al registrarse). */
  findLinkableCustomerIdByEmail(email: string): Promise<string | null>;
  createAccount(record: CreateAccountRecord): Promise<CustomerProfileRow>;
  getProfile(customerId: string): Promise<CustomerProfileRow | null>;
  touchLastLogin(accountId: string): Promise<void>;

  createSession(record: CreateSessionRecord): Promise<void>;
  findActiveSessionByTokenHash(tokenHash: string): Promise<ActiveSessionRow | null>;
  revokeSessionByTokenHash(tokenHash: string): Promise<void>;

  /** Crea una dirección del cliente; la marca primaria si aún no tiene una. */
  createAddress(record: CreateStoreAddressRecord): Promise<string>;
  /**
   * Resuelve la variante comprable de un producto PUBLISHED. Si variantId es
   * null usa la variante activa por defecto (menor position).
   */
  resolvePurchasableVariant(productId: string, variantId: string | null): Promise<{ variantId: string } | null>;
}
