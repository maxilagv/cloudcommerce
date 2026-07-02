import { processPendingDocumentsBatch } from "./processors/document-generation.js";
import { processMediaOutboxBatch } from "./processors/media-outbox.js";
import { processOrderForwardBatch } from "./processors/order-forward.js";
import { processExpiredReservationsBatch } from "./processors/reservation-expiration.js";

const runOnce = process.env.WORKER_RUN_ONCE === "true";
const intervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5_000);

const runAll = () =>
  Promise.all([
    processMediaOutboxBatch(),
    processExpiredReservationsBatch(),
    processPendingDocumentsBatch(),
    processOrderForwardBatch(),
  ]);

if (runOnce) {
  await runAll();
  process.exit(0);
}

await runAll();
setInterval(() => {
  runAll().catch((error: unknown) => {
    console.error(error);
  });
}, Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 5_000);
