import type { DocumentStoragePort } from "../../application/ports.js";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

export class LocalDocumentStorage implements DocumentStoragePort {
  public constructor(
    private readonly root: string,
    private readonly signedUrlSecret: string,
  ) {}

  public async putDocument(input: { storageKey: string; bytes: Buffer }): Promise<{ storageKey: string; checksum: string }> {
    const path = this.resolveInsideRoot(input.storageKey);
    if (!path) {
      throw new Error("Invalid document storage key");
    }
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.bytes);
    return { storageKey: input.storageKey, checksum: sha256(input.bytes) };
  }

  public async getSignedDownloadUrl(input: {
    storageKey: string;
    filename: string;
    ttlSeconds: number;
  }): Promise<{ url: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000);
    const expires = String(Math.floor(expiresAt.getTime() / 1000));
    const payload = `${input.storageKey}.${expires}.${input.filename}`;
    const signature = createHmac("sha256", this.signedUrlSecret).update(payload).digest("hex");
    const params = new URLSearchParams({
      key: input.storageKey,
      filename: input.filename,
      expires,
      signature,
    });
    return { url: `/finance/documents/download?${params.toString()}`, expiresAt };
  }

  public async getSignedDocument(input: {
    storageKey: string;
    filename: string;
    expires: number;
    signature: string;
  }): Promise<{ body: Buffer; filename: string } | null> {
    if (!Number.isInteger(input.expires) || input.expires * 1000 < Date.now()) {
      return null;
    }
    const payload = `${input.storageKey}.${input.expires}.${input.filename}`;
    const expected = createHmac("sha256", this.signedUrlSecret).update(payload).digest("hex");
    if (!safeEqual(expected, input.signature)) {
      return null;
    }
    const path = this.resolveInsideRoot(input.storageKey);
    if (!path) {
      return null;
    }
    const body = await readFile(path);
    return { body, filename: input.filename };
  }

  private resolveInsideRoot(storageKey: string): string | null {
    const root = resolve(this.root);
    const target = resolve(root, storageKey);
    return target === root || target.startsWith(`${root}${sep}`) ? target : null;
  }
}

const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

const safeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};
