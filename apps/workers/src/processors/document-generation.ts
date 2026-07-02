import * as schema from "@cloudcommerce/database";
import { commercialDocument } from "@cloudcommerce/database";
import { DocumentStatus } from "@cloudcommerce/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import pino from "pino";
import postgres from "postgres";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  STORAGE_LOCAL_ROOT: z.string().min(1).default(".cloudcommerce-media"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DOCUMENT_GENERATION_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(25),
});

const env = envSchema.parse(process.env);
const logger = pino({ level: env.LOG_LEVEL });
const sql = postgres(env.DATABASE_URL, { max: 2, prepare: false });
const db = drizzle(sql, { schema });

export async function processPendingDocumentsBatch(limit = env.DOCUMENT_GENERATION_BATCH_SIZE): Promise<void> {
  const rows = await db
    .select()
    .from(commercialDocument)
    .where(eq(commercialDocument.status, DocumentStatus.PROCESSING))
    .limit(limit);

  let processed = 0;
  for (const document of rows) {
    const storageKey = document.pdfStorageKey ?? `documents/${document.type.toLowerCase()}/${document.series}/${document.displayNumber}.ccdoc`;
    const bytes = Buffer.from(
      `CloudCommerce Document\n${JSON.stringify({
        id: document.id,
        type: document.type,
        series: document.series,
        displayNumber: document.displayNumber,
        orderId: document.orderId,
        totalMinor: document.totalMinor,
        currency: document.currency,
      })}\n`,
      "utf8",
    );
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const target = resolve(env.STORAGE_LOCAL_ROOT, storageKey);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
    await db
      .update(commercialDocument)
      .set({
        status: DocumentStatus.AVAILABLE,
        issuedAt: document.issuedAt ?? new Date(),
        pdfStorageKey: storageKey,
        pdfChecksum: checksum,
        updatedAt: new Date(),
      })
      .where(eq(commercialDocument.id, document.id));
    processed += 1;
  }

  if (processed > 0) {
    logger.info({ processed }, "Processed pending commercial documents");
  }
}
