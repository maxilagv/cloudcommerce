import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { MediaStoragePort, StoredMediaObject } from "../../application/ports/media-storage-port.js";

export class LocalFsMediaStorage implements MediaStoragePort {
  private readonly root: string;
  private readonly secret: string;

  public constructor(input: { root: string; signedUrlSecret: string }) {
    this.root = resolve(input.root);
    this.secret = input.signedUrlSecret;
  }

  public async putObject(input: { storageKey: string; body: Buffer; contentType: string }): Promise<StoredMediaObject> {
    const target = this.resolveStorageKey(input.storageKey);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, input.body, { flag: "wx" }).catch(async (error: unknown) => {
      if (isFileExistsError(error)) {
        return;
      }
      throw error;
    });
    return {
      storageKey: input.storageKey,
      byteSize: input.body.byteLength,
    };
  }

  public async getObject(input: { storageKey: string }): Promise<{ body: Buffer; contentType: string } | null> {
    const target = this.resolveStorageKey(input.storageKey);
    try {
      return {
        body: await readFile(target),
        contentType: contentTypeFromStorageKey(input.storageKey),
      };
    } catch (error: unknown) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  public async deleteObject(input: { storageKey: string }): Promise<void> {
    const target = this.resolveStorageKey(input.storageKey);
    await rm(target, { force: true });
  }

  public signUrl(input: { mediaAssetId: string; storageKey: string; expiresInSeconds: number }): string {
    const expiresAt = Math.floor(Date.now() / 1000) + input.expiresInSeconds;
    const signature = this.sign(input.mediaAssetId, input.storageKey, expiresAt);
    return `/media/assets/${input.mediaAssetId}/download?expires=${expiresAt}&signature=${signature}`;
  }

  public verifySignedUrl(input: { mediaAssetId: string; storageKey: string; expiresAt: number; signature: string }): boolean {
    if (input.expiresAt < Math.floor(Date.now() / 1000)) {
      return false;
    }
    const expected = this.sign(input.mediaAssetId, input.storageKey, input.expiresAt);
    const expectedBuffer = Buffer.from(expected, "base64url");
    const actualBuffer = Buffer.from(input.signature, "base64url");
    return expectedBuffer.byteLength === actualBuffer.byteLength && timingSafeEqual(expectedBuffer, actualBuffer);
  }

  private sign(mediaAssetId: string, storageKey: string, expiresAt: number): string {
    return createHmac("sha256", this.secret)
      .update(`${mediaAssetId}.${storageKey}.${expiresAt}`)
      .digest("base64url");
  }

  private resolveStorageKey(storageKey: string): string {
    const target = resolve(this.root, storageKey);
    if (!target.startsWith(this.root)) {
      throw new Error("Invalid storage key");
    }
    return target;
  }
}

const isNodeError = (error: unknown): error is NodeJS.ErrnoException => error instanceof Error && "code" in error;

const isNotFoundError = (error: unknown): boolean => isNodeError(error) && error.code === "ENOENT";

const isFileExistsError = (error: unknown): boolean => isNodeError(error) && error.code === "EEXIST";

const contentTypeFromStorageKey = (storageKey: string): string => {
  if (storageKey.endsWith(".jpg") || storageKey.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (storageKey.endsWith(".png")) {
    return "image/png";
  }
  if (storageKey.endsWith(".webp")) {
    return "image/webp";
  }
  if (storageKey.endsWith(".avif")) {
    return "image/avif";
  }
  return "application/octet-stream";
};
