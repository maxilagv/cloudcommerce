import { MediaSource, type Actor, type MediaAssetResponse } from "@cloudcommerce/types";
import { createHash } from "node:crypto";
import { v7 as uuidv7 } from "uuid";
import { err, ok, type Result } from "../../../../shared/domain/result.js";
import type { MediaDomainError } from "../../../../shared/errors/domain-error.js";
import { canWriteCatalog } from "../../../catalog/domain/policies/catalog-permissions.js";
import type { MediaStoragePort } from "../ports/media-storage-port.js";
import type { MediaRepository } from "../ports/media-repository.js";
import { validateAndNormalizeImage } from "./image-upload-validation.js";

export type UploadMediaInput = {
  body: Buffer;
  declaredContentType: string | null;
  originalFileName: string;
  altText?: string | null;
};

export class MediaService {
  public constructor(
    private readonly repository: MediaRepository,
    private readonly storage: MediaStoragePort,
    private readonly maxFileBytes: number,
  ) {}

  public async upload(actor: Actor, input: UploadMediaInput): Promise<Result<MediaAssetResponse, MediaDomainError>> {
    if (!canWriteCatalog(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }

    const normalized = await validateAndNormalizeImage({ buffer: input.body, maxBytes: this.maxFileBytes });
    if (!normalized.ok) {
      return err({ type: "MEDIA_UPLOAD_INVALID", reason: normalized.reason });
    }

    const checksum = createHash("sha256").update(normalized.value.buffer).digest("hex");
    const existing = await this.repository.findByChecksum(checksum);
    if (existing) {
      return ok(this.present(existing));
    }

    const mediaAssetId = uuidv7();
    const storageKey = this.storageKey(checksum, normalized.value.extension);
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
      altText: input.altText ?? null,
      source: MediaSource.UPLOAD,
      checksum,
      createdBy: actor.kind === "admin" ? actor.userId : null,
    });
    await this.repository.enqueueOutbox({
      id: uuidv7(),
      aggregateType: "media_asset",
      aggregateId: asset.id,
      eventType: "media.process",
      payload: { mediaAssetId: asset.id, storageKey: asset.storageKey },
    });
    return ok(this.present(asset));
  }

  public async getSignedUrl(
    actor: Actor,
    mediaAssetId: string,
    expiresInSeconds: number,
  ): Promise<Result<{ signedUrl: string }, MediaDomainError>> {
    if (actor.kind !== "admin") {
      return err({ type: "UNAUTHENTICATED" });
    }
    const asset = await this.repository.findById(mediaAssetId);
    if (!asset) {
      return err({ type: "MEDIA_NOT_FOUND" });
    }
    return ok({
      signedUrl: this.storage.signUrl({
        mediaAssetId: asset.id,
        storageKey: asset.storageKey,
        expiresInSeconds,
      }),
    });
  }

  public async updateAltText(
    actor: Actor,
    mediaAssetId: string,
    altText: string | null,
  ): Promise<Result<MediaAssetResponse, MediaDomainError>> {
    if (!canWriteCatalog(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const updated = await this.repository.updateAltText(mediaAssetId, altText);
    if (!updated) {
      return err({ type: "MEDIA_NOT_FOUND" });
    }
    return ok(this.present(updated));
  }

  public async getDownload(
    mediaAssetId: string,
    expiresAt: number,
    signature: string,
  ): Promise<Result<{ body: Buffer; contentType: string }, MediaDomainError>> {
    const asset = await this.repository.findById(mediaAssetId);
    if (!asset) {
      return err({ type: "MEDIA_NOT_FOUND" });
    }
    const valid = this.storage.verifySignedUrl({
      mediaAssetId: asset.id,
      storageKey: asset.storageKey,
      expiresAt,
      signature,
    });
    if (!valid) {
      return err({ type: "FORBIDDEN" });
    }
    const object = await this.storage.getObject({ storageKey: asset.storageKey });
    if (!object) {
      return err({ type: "MEDIA_NOT_FOUND" });
    }
    return ok(object);
  }

  private present(asset: {
    id: string;
    mime: string;
    byteSize: number;
    width: number | null;
    height: number | null;
    dominantColor: string | null;
    blurPlaceholder: string | null;
    altText: string | null;
    source: MediaSource;
    checksum: string;
    createdAt: Date;
  }): MediaAssetResponse {
    return {
      id: asset.id,
      mime: asset.mime,
      byteSize: asset.byteSize,
      width: asset.width,
      height: asset.height,
      dominantColor: asset.dominantColor,
      blurPlaceholder: asset.blurPlaceholder,
      altText: asset.altText,
      source: asset.source,
      checksum: asset.checksum,
      createdAt: asset.createdAt.toISOString(),
    };
  }

  private storageKey(checksum: string, extension: string): string {
    const prefix = checksum.slice(0, 4);
    return `uploads/${prefix.slice(0, 2)}/${prefix.slice(2, 4)}/${checksum}.${extension}`;
  }
}
