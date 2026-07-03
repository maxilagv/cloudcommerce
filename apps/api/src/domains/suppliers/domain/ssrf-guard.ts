import { isIP } from "node:net";

export type SsrfVerdict = { allowed: true; resolvedIp: string } | { allowed: false; reason: string };

export type DnsResolver = (hostname: string) => Promise<string[]>;

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

const isPrivateIpv4 = (ip: string): boolean => {
  const octets = ip.split(".").map(Number);
  const [a, b] = octets;
  if (a === undefined || b === undefined) return true;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
};

const isPrivateIpv6 = (ip: string): boolean => {
  const normalized = ip.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fe80") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpv4(normalized.slice(7));
  }
  return false;
};

export const isPrivateIp = (ip: string): boolean => {
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
};

/**
 * Guard SSRF para toda URL de proveedor (feeds, API base, webhooks salientes):
 * solo http/https, sin credenciales embebidas, hostname no bloqueado y — clave —
 * las IPs RESUELTAS deben ser públicas (anti DNS-rebinding). Debe re-ejecutarse
 * en cada corrida, no solo al guardar la configuración.
 */
export const validateExternalUrl = async (rawUrl: string, resolveDns: DnsResolver): Promise<SsrfVerdict> => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: "url_invalida" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { allowed: false, reason: "protocolo_no_permitido" };
  }
  if (url.username || url.password) {
    return { allowed: false, reason: "credenciales_en_url" };
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".internal")) {
    return { allowed: false, reason: "host_bloqueado" };
  }
  if (isIP(hostname)) {
    return isPrivateIp(hostname) ? { allowed: false, reason: "ip_privada" } : { allowed: true, resolvedIp: hostname };
  }
  let addresses: string[];
  try {
    addresses = await resolveDns(hostname);
  } catch {
    return { allowed: false, reason: "dns_no_resuelve" };
  }
  if (addresses.length === 0) {
    return { allowed: false, reason: "dns_no_resuelve" };
  }
  for (const address of addresses) {
    if (isPrivateIp(address)) {
      return { allowed: false, reason: "resuelve_a_red_privada" };
    }
  }
  return { allowed: true, resolvedIp: addresses[0] ?? hostname };
};
