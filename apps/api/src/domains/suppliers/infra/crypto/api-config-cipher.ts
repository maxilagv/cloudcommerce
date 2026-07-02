import { SupplierApiConfigSchema, type SupplierApiConfigInput } from "@cloudcommerce/validators";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { ApiConfigCipherPort } from "../../application/ports.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

/**
 * Cifrado en reposo de la config de API del proveedor (AES-256-GCM).
 * La clave se deriva del secreto de la app; el payload nunca se loggea ni se
 * devuelve por API. Formato: v1:<iv>:<tag>:<ciphertext> en base64url.
 */
export class AesApiConfigCipher implements ApiConfigCipherPort {
  private readonly key: Buffer;

  public constructor(secret: string) {
    this.key = createHash("sha256").update(`supplier-api-config:${secret}`).digest();
  }

  public encrypt(config: SupplierApiConfigInput): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const plaintext = Buffer.from(JSON.stringify(config), "utf8");
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
  }

  public decrypt(payload: string): SupplierApiConfigInput | null {
    try {
      const [version, ivPart, tagPart, dataPart] = payload.split(":");
      if (version !== "v1" || !ivPart || !tagPart || !dataPart) {
        return null;
      }
      const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivPart, "base64url"));
      decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
      const decrypted = Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]);
      const parsed = SupplierApiConfigSchema.safeParse(JSON.parse(decrypted.toString("utf8")));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }
}
