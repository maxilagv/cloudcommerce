import { SafeAttributesSchema } from "@cloudcommerce/validators";
import { describe, expect, it } from "vitest";
import { validateAndNormalizeImage } from "./application/services/image-upload-validation.js";

describe("media upload validation", () => {
  it("rejects a fake image even when a caller claims it has an allowed extension", async () => {
    const result = await validateAndNormalizeImage({
      buffer: Buffer.from("not really a png"),
      maxBytes: 1024,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("Tipo de imagen no permitido.");
    }
  });
});

describe("catalog json validators", () => {
  it("rejects prototype pollution keys in variant attributes", () => {
    const result = SafeAttributesSchema.safeParse({ constructor: { prototype: { polluted: true } } });

    expect(result.success).toBe(false);
  });
});
