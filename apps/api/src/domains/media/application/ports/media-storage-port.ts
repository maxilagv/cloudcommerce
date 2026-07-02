export type StoredMediaObject = {
  storageKey: string;
  byteSize: number;
};

export interface MediaStoragePort {
  putObject(input: { storageKey: string; body: Buffer; contentType: string }): Promise<StoredMediaObject>;
  getObject(input: { storageKey: string }): Promise<{ body: Buffer; contentType: string } | null>;
  deleteObject(input: { storageKey: string }): Promise<void>;
  signUrl(input: { mediaAssetId: string; storageKey: string; expiresInSeconds: number }): string;
  verifySignedUrl(input: { mediaAssetId: string; storageKey: string; expiresAt: number; signature: string }): boolean;
}
