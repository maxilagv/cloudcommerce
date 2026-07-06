import { category, product, productMedia } from "@cloudcommerce/database";
import { and, eq, max } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { Database } from "../../../../infrastructure/database/client.js";
import type { AiTargetWriterPort } from "../../application/ports.js";

const MAX_PRODUCT_MEDIA = 6;

/**
 * Aplica imágenes generadas por IA directamente sobre el catálogo. Mantiene el
 * invariante de publicación: mainImageId siempre debe existir también en
 * product_media, por eso el set de imagen principal registra la fila si falta.
 */
export class AiTargetWriter implements AiTargetWriterPort {
  public constructor(private readonly db: Database) {}

  public async getProductMainImageId(productId: string): Promise<string | null> {
    const rows = await this.db
      .select({ mainImageId: product.mainImageId })
      .from(product)
      .where(eq(product.id, productId))
      .limit(1);
    return rows[0]?.mainImageId ?? null;
  }

  public async getCategoryImageId(categoryId: string): Promise<string | null> {
    const rows = await this.db
      .select({ imageId: category.imageId })
      .from(category)
      .where(eq(category.id, categoryId))
      .limit(1);
    return rows[0]?.imageId ?? null;
  }

  public async setProductMainImage(productId: string, mediaAssetId: string): Promise<boolean> {
    const rows = await this.db.select({ id: product.id }).from(product).where(eq(product.id, productId)).limit(1);
    if (rows.length === 0) return false;

    const existing = await this.db
      .select({ id: productMedia.id })
      .from(productMedia)
      .where(and(eq(productMedia.productId, productId), eq(productMedia.mediaAssetId, mediaAssetId)))
      .limit(1);

    if (existing.length === 0) {
      const maxRows = await this.db
        .select({ maxPosition: max(productMedia.position) })
        .from(productMedia)
        .where(eq(productMedia.productId, productId));
      const nextPosition = (maxRows[0]?.maxPosition ?? -1) + 1;
      if (nextPosition < MAX_PRODUCT_MEDIA) {
        await this.db.insert(productMedia).values({
          id: uuidv7(),
          productId,
          mediaAssetId,
          position: nextPosition,
          altText: null,
        });
      } else {
        // Galería llena: la imagen IA reemplaza el slot 0 para poder ser principal.
        await this.db
          .update(productMedia)
          .set({ mediaAssetId })
          .where(and(eq(productMedia.productId, productId), eq(productMedia.position, 0)));
      }
    }

    await this.db
      .update(product)
      .set({ mainImageId: mediaAssetId, updatedAt: new Date() })
      .where(eq(product.id, productId));
    return true;
  }

  public async setCategoryImage(categoryId: string, mediaAssetId: string): Promise<boolean> {
    const rows = await this.db.select({ id: category.id }).from(category).where(eq(category.id, categoryId)).limit(1);
    if (rows.length === 0) return false;
    await this.db
      .update(category)
      .set({ imageId: mediaAssetId, updatedAt: new Date() })
      .where(eq(category.id, categoryId));
    return true;
  }
}
