import { describe, expect, it } from "vitest";
import { isPrivateIp, validateExternalUrl } from "../../domain/ssrf-guard.js";

const publicDns = async (): Promise<string[]> => ["93.184.216.34"];
const privateDns = async (): Promise<string[]> => ["10.0.0.5"];

describe("ssrf-guard", () => {
  it("permite URL https publica", async () => {
    const verdict = await validateExternalUrl("https://feeds.proveedor.com/products.csv", publicDns);
    expect(verdict.allowed).toBe(true);
  });

  it.each([
    ["http://localhost/feed.csv", "host_bloqueado"],
    ["http://127.0.0.1/feed.csv", "ip_privada"],
    ["http://10.1.2.3/feed.csv", "ip_privada"],
    ["http://172.16.0.1/feed.csv", "ip_privada"],
    ["http://192.168.1.1/feed.csv", "ip_privada"],
    ["http://169.254.169.254/latest/meta-data", "ip_privada"],
    ["file:///etc/passwd", "protocolo_no_permitido"],
    ["gopher://internal/feed", "protocolo_no_permitido"],
    ["http://user:pass@feeds.example.com/feed", "credenciales_en_url"],
    ["http://metadata.google.internal/computeMetadata", "host_bloqueado"],
  ])("bloquea %s", async (url, reason) => {
    const verdict = await validateExternalUrl(url, publicDns);
    expect(verdict).toEqual({ allowed: false, reason });
  });

  it("bloquea hostnames que resuelven a redes privadas (DNS rebinding)", async () => {
    const verdict = await validateExternalUrl("https://feed-malicioso.example.com/feed.csv", privateDns);
    expect(verdict).toEqual({ allowed: false, reason: "resuelve_a_red_privada" });
  });

  it("bloquea IPv6 loopback y mapeos IPv4 privados", () => {
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
    expect(isPrivateIp("::ffff:192.168.0.1")).toBe(true);
    expect(isPrivateIp("2607:f8b0:4004:c07::71")).toBe(false);
  });
});
