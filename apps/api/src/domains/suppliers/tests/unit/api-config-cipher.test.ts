import type { SupplierApiConfigInput } from "@cloudcommerce/validators";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AesApiConfigCipher } from "../../infra/crypto/api-config-cipher.js";

const masterSecret = "cookie-secret-with-enough-entropy-for-tests";

const config: SupplierApiConfigInput = {
  baseUrl: "https://api.supplier.example",
  authKind: "api_key",
  apiKey: "supplier-api-key",
};

describe("AesApiConfigCipher", () => {
  it("encrypts new supplier API configs as v2 payloads", () => {
    const cipher = new AesApiConfigCipher(masterSecret);

    const encrypted = cipher.encrypt(config);

    expect(encrypted.startsWith("v2:")).toBe(true);
    expect(cipher.decrypt(encrypted)).toEqual(config);
  });

  it("decrypts legacy v1 payloads produced with the raw cookie secret", () => {
    const legacyPayload = legacyEncrypt(config, masterSecret);
    const cipher = new AesApiConfigCipher(masterSecret);

    expect(legacyPayload.startsWith("v1:")).toBe(true);
    expect(cipher.decrypt(legacyPayload)).toEqual(config);
  });
});

const legacyEncrypt = (value: SupplierApiConfigInput, secret: string): string => {
  const key = createHash("sha256").update(`supplier-api-config:${secret}`).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
};
