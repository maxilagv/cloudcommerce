import {
  category,
  customer,
  customerConsent,
  order,
  orderLine,
  price,
  product,
  productVariant,
} from "@cloudcommerce/database";
import { CustomerConsentKind, OrderStatus, ProductStatus } from "@cloudcommerce/types";
import { and, desc, eq, inArray, isNull, lte, notInArray, or, sql } from "drizzle-orm";
import type { Database } from "../../../../infrastructure/database/client.js";
import type {
  EngagementContextReaderPort,
  EngagementCustomerSnapshot,
  EngagementSaleCandidate,
} from "../../application/ports.js";

const PURCHASE_LINES_LIMIT = 30;

/**
 * Read model del dominio engagement. Construye el snapshot MÍNIMO del cliente
 * que puede viajar a la IA (nombre de pila, tier e historial de compras) y los
 * candidatos de venta del catálogo publicado.
 */
export class EngagementContextReadModel implements EngagementContextReaderPort {
  public constructor(private readonly db: Database) {}

  public async getCustomerSnapshot(customerId: string): Promise<EngagementCustomerSnapshot | null> {
    const row = await this.db.query.customer.findFirst({
      where: and(eq(customer.id, customerId), isNull(customer.deletedAt)),
    });
    if (!row) {
      return null;
    }
    const purchases = await this.db
      .select({
        productTitle: orderLine.productTitleSnapshot,
        categoryName: category.name,
        quantity: orderLine.quantity,
        unitPriceMinor: orderLine.unitPriceMinor,
        purchasedAt: order.createdAt,
      })
      .from(orderLine)
      .innerJoin(order, eq(orderLine.orderId, order.id))
      .leftJoin(productVariant, eq(orderLine.variantId, productVariant.id))
      .leftJoin(product, eq(productVariant.productId, product.id))
      .leftJoin(category, eq(product.categoryId, category.id))
      .where(and(eq(order.customerId, customerId), notInArray(order.status, [OrderStatus.DRAFT, OrderStatus.CANCELLED])))
      .orderBy(desc(order.createdAt), desc(orderLine.id))
      .limit(PURCHASE_LINES_LIMIT);
    return {
      customerId: row.id,
      firstName: row.firstName,
      displayName: row.displayName,
      tier: row.tier,
      whatsapp: row.whatsapp,
      locale: "es-AR",
      purchases: purchases.map((line) => ({
        productTitle: line.productTitle,
        categoryName: line.categoryName ?? "",
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
        purchasedAt: line.purchasedAt.toISOString(),
      })),
      lastOrderAt: purchases[0]?.purchasedAt ?? null,
    };
  }

  public async hasWhatsappConsent(customerId: string): Promise<boolean> {
    // El consentimiento vigente es el último registrado para el kind: cada
    // cambio inserta una fila nueva con granted true/false.
    const [latest] = await this.db
      .select({ granted: customerConsent.granted })
      .from(customerConsent)
      .where(and(eq(customerConsent.customerId, customerId), eq(customerConsent.kind, CustomerConsentKind.MARKETING_WHATSAPP)))
      .orderBy(desc(customerConsent.grantedAt), desc(customerConsent.id))
      .limit(1);
    return latest?.granted === true;
  }

  public async listSaleCandidates(limit: number): Promise<EngagementSaleCandidate[]> {
    const rows = await this.db
      .select({
        productId: product.id,
        title: product.title,
        categoryName: category.name,
      })
      .from(product)
      .innerJoin(category, eq(product.categoryId, category.id))
      .where(and(eq(product.status, ProductStatus.PUBLISHED), isNull(product.deletedAt)))
      .orderBy(desc(product.publishedAt))
      .limit(limit);
    if (rows.length === 0) {
      return [];
    }
    const productIds = rows.map((row) => row.productId);
    const variants = await this.db
      .select({ variantId: productVariant.id, productId: productVariant.productId })
      .from(productVariant)
      .where(and(inArray(productVariant.productId, productIds), eq(productVariant.isActive, true)));
    const variantIds = variants.map((variant) => variant.variantId);
    const priceByVariant = new Map<string, number>();
    if (variantIds.length > 0) {
      const now = new Date();
      const prices = await this.db
        .select({ variantId: price.variantId, amountMinor: price.amountMinor })
        .from(price)
        .where(
          and(
            inArray(price.variantId, variantIds),
            lte(price.validFrom, now),
            or(isNull(price.validTo), sql`${price.validTo} > ${now}`),
          ),
        )
        .orderBy(desc(price.validFrom));
      for (const row of prices) {
        if (!priceByVariant.has(row.variantId)) {
          priceByVariant.set(row.variantId, row.amountMinor);
        }
      }
    }
    const priceByProduct = new Map<string, number>();
    for (const variant of variants) {
      const amount = priceByVariant.get(variant.variantId);
      if (amount === undefined) continue;
      const current = priceByProduct.get(variant.productId);
      if (current === undefined || amount < current) {
        priceByProduct.set(variant.productId, amount);
      }
    }
    return rows.map((row) => ({
      productId: row.productId,
      title: row.title,
      categoryName: row.categoryName,
      priceMinor: priceByProduct.get(row.productId) ?? null,
      currency: "ARS",
      inStock: true,
    }));
  }
}
