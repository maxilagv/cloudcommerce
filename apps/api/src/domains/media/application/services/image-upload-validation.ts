import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

export type NormalizedUpload = {
  buffer: Buffer;
  mime: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
  extension: "jpg" | "png" | "webp" | "avif";
  width: number;
  height: number;
};

const allowedMimeToFormat = {
  "image/jpeg": { format: "jpeg", extension: "jpg" },
  "image/png": { format: "png", extension: "png" },
  "image/webp": { format: "webp", extension: "webp" },
  "image/avif": { format: "avif", extension: "avif" },
} as const;

export async function validateAndNormalizeImage(input: {
  buffer: Buffer;
  maxBytes: number;
}): Promise<{ ok: true; value: NormalizedUpload } | { ok: false; reason: string }> {
  if (input.buffer.byteLength === 0) {
    return { ok: false, reason: "El archivo esta vacio." };
  }
  if (input.buffer.byteLength > input.maxBytes) {
    return { ok: false, reason: "El archivo supera el tamano maximo permitido." };
  }

  const detected = await fileTypeFromBuffer(input.buffer);
  if (!detected || !(detected.mime in allowedMimeToFormat)) {
    return { ok: false, reason: "Tipo de imagen no permitido." };
  }

  const target = allowedMimeToFormat[detected.mime as keyof typeof allowedMimeToFormat];
  try {
    const image = sharp(input.buffer, { failOn: "error" }).rotate();
    const normalized = await image.toFormat(target.format).toBuffer();
    const metadata = await sharp(normalized).metadata();
    if (!metadata.width || !metadata.height) {
      return { ok: false, reason: "No se pudieron leer las dimensiones de la imagen." };
    }
    return {
      ok: true,
      value: {
        buffer: normalized,
        mime: detected.mime as NormalizedUpload["mime"],
        extension: target.extension,
        width: metadata.width,
        height: metadata.height,
      },
    };
  } catch {
    return { ok: false, reason: "La imagen no pudo procesarse de forma segura." };
  }
}
