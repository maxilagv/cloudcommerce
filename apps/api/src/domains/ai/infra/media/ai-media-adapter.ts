import { MediaSource } from "@cloudcommerce/types";
import { createHash } from "node:crypto";
import { v7 as uuidv7 } from "uuid";
import { validateAndNormalizeImage } from "../../../media/application/services/image-upload-validation.js";
import type { MediaRepository } from "../../../media/application/ports/media-repository.js";
import type { MediaStoragePort } from "../../../media/application/ports/media-storage-port.js";
import type { AiImagePayload, AiMediaPort } from "../../application/ports.js";

/**
 * Puente entre el dominio IA y el storage de media. Lee la imagen fuente por
 * mediaAssetId y persiste las imágenes generadas como assets con source=AI
 * (mismo pipeline que un upload manual: normalización sharp + outbox
 * media.process para dominantColor/blurPlaceholder).
 */
export class AiMediaAdapter implements AiMediaPort {
  public constructor(
    private readonly repository: MediaRepository,
    private readonly storage: MediaStoragePort,
    private readonly maxFileBytes: number,
  ) {}

  public async loadImage(mediaAssetId: string): Promise<AiImagePayload | null> {
    const asset = await this.repository.findById(mediaAssetId);
    if (!asset) return null;
    const object = await this.storage.getObject({ storageKey: asset.storageKey });
    if (!object) return null;
    return { data: object.body.toString("base64"), mimeType: object.contentType || asset.mime };
  }

  public async saveGeneratedImage(input: {
    data: string;
    mimeType: string;
    altText: string | null;
    createdBy: string | null;
  }): Promise<{ mediaAssetId: string } | null> {
    let buffer: Buffer;
    try {
      buffer = Buffer.from(input.data, "base64");
    } catch {
      return null;
    }
    const normalized = await validateAndNormalizeImage({ buffer, maxBytes: this.maxFileBytes });
    if (!normalized.ok) {
      return null;
    }
    const checksum = createHash("sha256").update(normalized.value.buffer).digest("hex");
    const existing = await this.repository.findByChecksum(checksum);
    if (existing) {
      return { mediaAssetId: existing.id };
    }
    const mediaAssetId = uuidv7();
    const prefix = checksum.slice(0, 4);
    const storageKey = `ai/${prefix.slice(0, 2)}/${prefix.slice(2, 4)}/${checksum}.${normalized.value.extension}`;
    await this.storage.putObject({
      storageKey,
      body: normalized.value.buffer,
      contentType: normalized.value.mime,
    });
    const asset = await this.repository.create({
      id: mediaAssetId,
      storageKey,
      mime: normalized.value.mime,
      byteSize: normalized.value.buffer.byteLength,
      width: normalized.value.width,
      height: normalized.value.height,
      dominantColor: null,
      blurPlaceholder: null,
      altText: input.altText,
      source: MediaSource.AI,
      checksum,
      createdBy: input.createdBy,
    });
    await this.repository.enqueueOutbox({
      id: uuidv7(),
      aggregateType: "media_asset",
      aggregateId: asset.id,
      eventType: "media.process",
      payload: { mediaAssetId: asset.id, storageKey: asset.storageKey },
    });
    return { mediaAssetId: asset.id };
  }
}
