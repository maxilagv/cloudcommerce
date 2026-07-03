import { SupplierFeedKind } from "@cloudcommerce/types";
import { err, ok, type Result } from "../../../../shared/domain/result.js";
import type { FeedFetcherPort } from "../../application/ports.js";
import { requestPinned } from "./pinned-http-client.js";

const FETCH_TIMEOUT_MS = 60_000;
const MAX_BODY_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 50_000;

/**
 * Descarga y parsea el feed del proveedor. La validación SSRF de la URL ocurre
 * ANTES, en el caso de uso (se re-valida en cada corrida); acá se aplican
 * límites de tamaño, timeout y bloqueo de redirects (una redirección puede
 * apuntar a la red interna).
 */
export class HttpFeedFetcher implements FeedFetcherPort {
  public async fetchRows(input: {
    kind: SupplierFeedKind;
    sourceUrl: string;
    resolvedIp: string;
  }): Promise<Result<Array<Record<string, unknown>>, { type: "UPSTREAM_UNAVAILABLE" } | { type: "INVALID_FORMAT" }>> {
    let body: string;
    try {
      const response = await requestPinned({
        url: input.sourceUrl,
        resolvedIp: input.resolvedIp,
        method: "GET",
        headers: { accept: input.kind === SupplierFeedKind.CSV ? "text/csv" : "application/json" },
        timeoutMs: FETCH_TIMEOUT_MS,
        maxBodyBytes: MAX_BODY_BYTES,
      });
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return err({ type: "UPSTREAM_UNAVAILABLE" });
      }
      const contentLengthHeader = response.headers["content-length"];
      const contentLength = Number(Array.isArray(contentLengthHeader) ? contentLengthHeader[0] : contentLengthHeader ?? 0);
      if (contentLength > MAX_BODY_BYTES) {
        return err({ type: "INVALID_FORMAT" });
      }
      body = response.body;
    } catch {
      return err({ type: "UPSTREAM_UNAVAILABLE" });
    }
    return input.kind === SupplierFeedKind.CSV ? parseCsv(body) : parseJson(body);
  }
}

const parseJson = (body: string): Result<Array<Record<string, unknown>>, { type: "INVALID_FORMAT" }> => {
  try {
    const parsed: unknown = JSON.parse(body);
    const rows = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { items?: unknown }).items) ? (parsed as { items: unknown[] }).items : null;
    if (!rows) {
      return err({ type: "INVALID_FORMAT" });
    }
    const records: Array<Record<string, unknown>> = [];
    for (const row of rows.slice(0, MAX_ROWS)) {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        records.push(row as Record<string, unknown>);
      }
    }
    return ok(records);
  } catch {
    return err({ type: "INVALID_FORMAT" });
  }
};

const parseCsv = (body: string): Result<Array<Record<string, unknown>>, { type: "INVALID_FORMAT" }> => {
  const lines = body.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headerLine = lines[0];
  if (!headerLine) {
    return err({ type: "INVALID_FORMAT" });
  }
  const headers = splitCsvLine(headerLine).map((header) => header.trim());
  if (headers.length === 0 || headers.every((header) => header.length === 0)) {
    return err({ type: "INVALID_FORMAT" });
  }
  const rows: Array<Record<string, unknown>> = [];
  for (const line of lines.slice(1, MAX_ROWS + 1)) {
    const values = splitCsvLine(line);
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (header.length > 0) {
        row[header] = values[index]?.trim() ?? "";
      }
    });
    rows.push(row);
  }
  return ok(rows);
};

/** Parser CSV mínimo con soporte de comillas dobles (RFC 4180 básico). */
const splitCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
};
