import { SupplierApiConfigSchema, type SupplierApiConfigInput } from "@cloudcommerce/validators";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import type { ApiConfigCipherPort } from "../../application/ports.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const CURRENT_VERSION = "v2";
const LEGACY_VERSION = "v1";

/**
 * Cifrado en reposo de la config de API del proveedor (AES-256-GCM).
 * La clave se deriva del secreto de la app; el payload nunca se loggea ni se
 * devuelve por API. Formato: v2:<iv>:<tag>:<ciphertext> en base64url.
 */
export class AesApiConfigCipher implements ApiConfigCipherPort {
  private readonly currentKey: Buffer;
  private readonly legacyV1Key: Buffer;

  public constructor(masterSecret: string) {
    this.currentKey = deriveAesKey(derivePurposeSecret(masterSecret));
    this.legacyV1Key = deriveAesKey(masterSecret);
  }

  public encrypt(config: SupplierApiConfigInput): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.currentKey, iv);
    const plaintext = Buffer.from(JSON.stringify(config), "utf8");
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${CURRENT_VERSION}:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
  }

  public decrypt(payload: string): SupplierApiConfigInput | null {
    const [version, ivPart, tagPart, dataPart] = payload.split(":");
    if (!ivPart || !tagPart || !dataPart) {
      return null;
    }
    if (version === CURRENT_VERSION) {
      return decryptWithKey({ ivPart, tagPart, dataPart }, this.currentKey);
    }
    if (version === LEGACY_VERSION) {
      return decryptWithKey({ ivPart, tagPart, dataPart }, this.legacyV1Key) ?? decryptWithKey({ ivPart, tagPart, dataPart }, this.currentKey);
    }
    return null;
  }
}

const derivePurposeSecret = (secret: string): string =>
  createHmac("sha256", secret).update("cloudcommerce:supplier-api-config").digest("base64url");

const deriveAesKey = (secret: string): Buffer => createHash("sha256").update(`supplier-api-config:${secret}`).digest();

const decryptWithKey = (
  input: { ivPart: string; tagPart: string; dataPart: string },
  key: Buffer,
): SupplierApiConfigInput | null => {
  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(input.ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(input.tagPart, "base64url"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(input.dataPart, "base64url")), decipher.final()]);
    const parsed = SupplierApiConfigSchema.safeParse(JSON.parse(decrypted.toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};
