import { mediaAsset, outboxEvent } from "@cloudcommerce/database";
import { eq } from "drizzle-orm";
import type { Database } from "../../../../infrastructure/database/client.js";
import type { MediaAssetEntity } from "../../../catalog/domain/entities/catalog-entities.js";
import { mapMediaAsset } from "../../../catalog/infra/mappers/catalog-mapper.js";
import type { CreateMediaAssetRecord, MediaRepository } from "../../application/ports/media-repository.js";

export class DrizzleMediaRepository implements MediaRepository {
  public constructor(private readonly db: Database) {}

  public async findById(id: string): Promise<MediaAssetEntity | null> {
    const row = await this.db.query.mediaAsset.findFirst({ where: eq(mediaAsset.id, id) });
    return row ? mapMediaAsset(row) : null;
  }

  public async findByChecksum(checksum: string): Promise<MediaAssetEntity | null> {
    const row = await this.db.query.mediaAsset.findFirst({ where: eq(mediaAsset.checksum, checksum) });
    return row ? mapMediaAsset(row) : null;
  }

  public async create(input: CreateMediaAssetRecord): Promise<MediaAssetEntity> {
    const [row] = await this.db.insert(mediaAsset).values(input).returning();
    if (!row) {
      throw new Error("Failed to create media asset");
    }
    return mapMediaAsset(row);
  }

  public async updateAltText(id: string, altText: string | null): Promise<MediaAssetEntity | null> {
    const [row] = await this.db.update(mediaAsset).set({ altText }).where(eq(mediaAsset.id, id)).returning();
    return row ? mapMediaAsset(row) : null;
  }

  public async enqueueOutbox(event: {
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(outboxEvent).values(event);
  }
}
