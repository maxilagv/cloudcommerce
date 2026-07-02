import { lookup } from "node:dns/promises";
import { validateExternalUrl, type SsrfVerdict } from "../../domain/ssrf-guard.js";
import type { UrlGuardPort } from "../../application/ports.js";

export class DnsUrlGuard implements UrlGuardPort {
  public async validate(url: string): Promise<SsrfVerdict> {
    return validateExternalUrl(url, async (hostname) => {
      const records = await lookup(hostname, { all: true });
      return records.map((record) => record.address);
    });
  }
}
