import type { MediaSource } from "@cloudcommerce/types";
import type { MediaAssetEntity } from "../../../catalog/domain/entities/catalog-entities.js";

export type CreateMediaAssetRecord = {
  id: string;
  storageKey: string;
  mime: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  dominantColor: string | null;
  blurPlaceholder: string | null;
  altText: string | null;
  source: MediaSource;
  checksum: string;
  createdBy: string | null;
};

export interface MediaRepository {
  findById(id: string): Promise<MediaAssetEntity | null>;
  findByChecksum(checksum: string): Promise<MediaAssetEntity | null>;
  create(input: CreateMediaAssetRecord): Promise<MediaAssetEntity>;
  updateAltText(id: string, altText: string | null): Promise<MediaAssetEntity | null>;
  enqueueOutbox(event: {
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
}
