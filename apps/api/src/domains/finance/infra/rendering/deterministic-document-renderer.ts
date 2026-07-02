import type { PdfRendererPort, RenderedDocument } from "../../application/ports.js";
import { createHash } from "node:crypto";

export class DeterministicDocumentRenderer implements PdfRendererPort {
  public async render(input: Parameters<PdfRendererPort["render"]>[0]): Promise<RenderedDocument> {
    const canonical = stableStringify({
      type: input.type,
      series: input.series,
      displayNumber: input.displayNumber,
      issuedAt: input.issuedAt.toISOString(),
      order: {
        id: input.order.id,
        orderNumber: input.order.orderNumber,
        customerId: input.order.customerId,
        totalMinor: input.order.totalMinor,
        currency: input.order.currency,
        lines: input.order.lines.map((line) => ({
          variantId: line.variantId,
          productTitle: line.productTitle,
          sku: line.sku,
          quantity: line.quantity,
          unitPriceMinor: line.unitPriceMinor,
          lineTotalMinor: line.lineTotalMinor,
        })),
      },
    });
    // This deterministic byte stream is the current document artifact. A real PDF renderer can replace this port.
    const bytes = Buffer.from(`CloudCommerce Document\n${canonical}\n`, "utf8");
    return {
      bytes,
      contentHash: sha256(bytes),
    };
  }
}

const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(",")}}`;
};
