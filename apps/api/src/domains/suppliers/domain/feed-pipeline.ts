import type { SupplierFeedRow } from "@cloudcommerce/validators";
import { createHash } from "node:crypto";

export type FeedRowDiff = {
  costChanged: boolean;
  stockChanged: boolean;
  discontinued: boolean;
  contentHash: string;
};

/**
 * Hash de detección de cambios: solo sobre los campos que gobiernan precio,
 * stock y estado. Si coincide con el hash guardado, la fila se salta entera
 * (idempotencia de import + performance).
 */
export const computeContentHash = (row: SupplierFeedRow): string =>
  createHash("sha256")
    .update(JSON.stringify({
      cost: row.costAmountMinor ?? null,
      stock: row.stock ?? null,
      discontinued: row.discontinued,
    }))
    .digest("hex");

export const diffFeedRow = (row: SupplierFeedRow, previous: { contentHash: string | null } | null): FeedRowDiff | "unchanged" => {
  const contentHash = computeContentHash(row);
  if (previous?.contentHash === contentHash) {
    return "unchanged";
  }
  return {
    costChanged: row.costAmountMinor !== undefined,
    stockChanged: row.stock !== undefined,
    discontinued: row.discontinued,
    contentHash,
  };
};

/** Bloquea claves peligrosas antes de persistir el raw del proveedor (prototype pollution). */
export const sanitizeRawRow = (raw: Record<string, unknown>): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === "__proto__" || key === "prototype" || key === "constructor") {
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
};

/** Clave determinística del forward: reintentos de cola no duplican pedidos. */
export const forwardIdempotencyKey = (orderId: string, supplierId: string): string =>
  createHash("sha256").update(`forward:${orderId}:${supplierId}`).digest("hex");
