import {
  customer,
  customerAccount,
  customerAddress,
  customerSession,
  product,
  productVariant,
} from "@cloudcommerce/database";
import { CustomerTier, ProductStatus } from "@cloudcommerce/types";
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { Database } from "../../../../infrastructure/database/client.js";
import type {
  ActiveSessionRow,
  CreateAccountRecord,
  CreateSessionRecord,
  CreateStoreAddressRecord,
  CustomerAccountRow,
  CustomerProfileRow,
  StorefrontRepository,
} from "../../application/ports.js";

export class DrizzleStorefrontRepository implements StorefrontRepository {
  public constructor(private readonly db: Database) {}

  public async findAccountByEmail(email: string): Promise<CustomerAccountRow | null> {
    const [row] = await this.db
      .select()
      .from(customerAccount)
      .where(sql`lower(${customerAccount.email}) = ${email.toLowerCase()}`)
      .limit(1);
    return row ? mapAccount(row) : null;
  }

  public async findLinkableCustomerIdByEmail(email: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: customer.id })
      .from(customer)
      .leftJoin(customerAccount, eq(customerAccount.customerId, customer.id))
      .where(and(sql`lower(${customer.email}) = ${email.toLowerCase()}`, isNull(customer.deletedAt), isNull(customerAccount.id)))
      .orderBy(asc(customer.createdAt))
      .limit(1);
    return row?.id ?? null;
  }

  public async createAccount(record: CreateAccountRecord): Promise<CustomerProfileRow> {
    return this.db.transaction(async (tx) => {
      let customerId = record.customerId;
      if (customerId) {
        // Vincula el cliente CRM existente y completa datos faltantes.
        await tx
          .update(customer)
          .set({
            ...(record.whatsapp ? { whatsapp: record.whatsapp } : {}),
            updatedAt: new Date(),
          })
          .where(eq(customer.id, customerId));
      } else {
        customerId = uuidv7();
        await tx.insert(customer).values({
          id: customerId,
          firstName: record.firstName,
          lastName: record.lastName,
          displayName: `${record.firstName} ${record.lastName}`,
          email: record.email,
          whatsapp: record.whatsapp,
          tier: CustomerTier.CloudBase,
        });
      }
      await tx.insert(customerAccount).values({
        id: record.accountId,
        customerId,
        email: record.email,
        passwordHash: record.passwordHash,
      });
      const row = await tx.query.customer.findFirst({ where: eq(customer.id, customerId) });
      if (!row) {
        throw new Error("Failed to create storefront account");
      }
      return mapProfile(row, record.email);
    });
  }

  public async getProfile(customerId: string): Promise<CustomerProfileRow | null> {
    const [row] = await this.db
      .select({ customerRow: customer, email: customerAccount.email })
      .from(customer)
      .innerJoin(customerAccount, eq(customerAccount.customerId, customer.id))
      .where(and(eq(customer.id, customerId), isNull(customer.deletedAt)))
      .limit(1);
    return row ? mapProfile(row.customerRow, row.email) : null;
  }

  public async touchLastLogin(accountId: string): Promise<void> {
    await this.db
      .update(customerAccount)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(customerAccount.id, accountId));
  }

  public async createSession(record: CreateSessionRecord): Promise<void> {
    await this.db.insert(customerSession).values(record);
  }

  public async findActiveSessionByTokenHash(tokenHash: string): Promise<ActiveSessionRow | null> {
    const [row] = await this.db
      .select({
        sessionId: customerSession.id,
        accountId: customerSession.accountId,
        customerId: customerAccount.customerId,
        accountActive: customerAccount.isActive,
        expiresAt: customerSession.expiresAt,
      })
      .from(customerSession)
      .innerJoin(customerAccount, eq(customerSession.accountId, customerAccount.id))
      .where(
        and(
          eq(customerSession.sessionTokenHash, tokenHash),
          isNull(customerSession.revokedAt),
          gt(customerSession.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  public async revokeSessionByTokenHash(tokenHash: string): Promise<void> {
    await this.db
      .update(customerSession)
      .set({ revokedAt: new Date() })
      .where(and(eq(customerSession.sessionTokenHash, tokenHash), isNull(customerSession.revokedAt)));
  }

  public async createAddress(record: CreateStoreAddressRecord): Promise<string> {
    return this.db.transaction(async (tx) => {
      const [existingPrimary] = await tx
        .select({ id: customerAddress.id })
        .from(customerAddress)
        .where(and(eq(customerAddress.customerId, record.customerId), eq(customerAddress.isPrimary, true)))
        .limit(1);
      const id = uuidv7();
      await tx.insert(customerAddress).values({
        id,
        customerId: record.customerId,
        recipientName: record.recipientName,
        province: record.province,
        city: record.city,
        street: record.street,
        streetNumber: record.streetNumber,
        postalCode: record.postalCode,
        isPrimary: !existingPrimary,
      });
      return id;
    });
  }

  public async resolvePurchasableVariant(productId: string, variantId: string | null): Promise<{ variantId: string } | null> {
    const conditions = [
      eq(productVariant.productId, productId),
      eq(productVariant.isActive, true),
      eq(product.status, ProductStatus.PUBLISHED),
      isNull(product.deletedAt),
    ];
    if (variantId) {
      conditions.push(eq(productVariant.id, variantId));
    }
    const [row] = await this.db
      .select({ variantId: productVariant.id })
      .from(productVariant)
      .innerJoin(product, eq(productVariant.productId, product.id))
      .where(and(...conditions))
      .orderBy(asc(productVariant.position), asc(productVariant.createdAt))
      .limit(1);
    return row ?? null;
  }
}

const mapAccount = (row: typeof customerAccount.$inferSelect): CustomerAccountRow => ({
  id: row.id,
  customerId: row.customerId,
  email: row.email,
  passwordHash: row.passwordHash,
  isActive: row.isActive,
});

const mapProfile = (row: typeof customer.$inferSelect, email: string): CustomerProfileRow => ({
  customerId: row.id,
  email,
  firstName: row.firstName,
  lastName: row.lastName,
  displayName: row.displayName,
  tier: row.tier as CustomerTier,
  whatsapp: row.whatsapp,
});
