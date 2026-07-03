import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupplierFeedKind } from "@cloudcommerce/types";

const transport = vi.hoisted(() => ({
  httpRequest: vi.fn(),
  httpsRequest: vi.fn(),
}));

vi.mock("node:http", () => ({
  default: { request: transport.httpRequest },
  request: transport.httpRequest,
}));

vi.mock("node:https", () => ({
  default: { request: transport.httpsRequest },
  request: transport.httpsRequest,
}));

const { requestPinned } = await import("../../infra/integrations/pinned-http-client.js");
const { HttpFeedFetcher } = await import("../../infra/integrations/http-feed-fetcher.js");
const { HttpSupplierForwarder } = await import("../../infra/integrations/http-supplier-forwarder.js");

describe("requestPinned", () => {
  beforeEach(() => {
    transport.httpRequest.mockReset();
    transport.httpsRequest.mockReset();
  });

  it("connects to the SSRF-validated IP while preserving the original Host and TLS servername", async () => {
    mockResponse(transport.httpsRequest, { statusCode: 200, bodyChunks: [Buffer.from("ok")] });

    await requestPinned({
      url: "https://supplier.example:8443/feed?cursor=1",
      resolvedIp: "203.0.113.10",
      method: "GET",
      headers: { accept: "application/json" },
      timeoutMs: 1_000,
      maxBodyBytes: 1_024,
    });

    const [options] = transport.httpsRequest.mock.calls[0] ?? [];
    expect(options).toMatchObject({
      protocol: "https:",
      hostname: "203.0.113.10",
      port: "8443",
      path: "/feed?cursor=1",
      servername: "supplier.example",
    });
    expect(options.headers).toMatchObject({
      accept: "application/json",
      host: "supplier.example:8443",
    });
  });

  it("aborts the request as soon as the response body exceeds the configured cap", async () => {
    const request = mockResponse(transport.httpRequest, {
      statusCode: 200,
      bodyChunks: [Buffer.from("1234"), Buffer.from("5678")],
    });

    await expect(
      requestPinned({
        url: "http://supplier.example/feed",
        resolvedIp: "203.0.113.10",
        method: "GET",
        headers: {},
        timeoutMs: 1_000,
        maxBodyBytes: 4,
      }),
    ).rejects.toThrow("response_too_large");

    expect(request.destroy).toHaveBeenCalledWith(expect.objectContaining({ message: "response_too_large" }));
  });

  it("does not follow redirects and lets callers surface them as upstream failures", async () => {
    mockResponse(transport.httpRequest, { statusCode: 302, bodyChunks: [Buffer.from("redirect")] });

    const result = await new HttpFeedFetcher().fetchRows({
      kind: SupplierFeedKind.API,
      sourceUrl: "http://supplier.example/feed",
      resolvedIp: "203.0.113.10",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("UPSTREAM_UNAVAILABLE");
    }
    expect(transport.httpRequest).toHaveBeenCalledTimes(1);
  });

  it("maps non-2xx feed responses to upstream failures", async () => {
    mockResponse(transport.httpRequest, { statusCode: 404, bodyChunks: [Buffer.from("not found")] });

    const result = await new HttpFeedFetcher().fetchRows({
      kind: SupplierFeedKind.API,
      sourceUrl: "http://supplier.example/feed",
      resolvedIp: "203.0.113.10",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("UPSTREAM_UNAVAILABLE");
    }
  });

  it("maps supplier forwarder 5xx responses to upstream failures", async () => {
    mockResponse(transport.httpsRequest, { statusCode: 500, bodyChunks: [Buffer.from("{}")] });

    const result = await new HttpSupplierForwarder().forwardOrder({
      apiConfig: { baseUrl: "https://supplier.example", authKind: "api_key", apiKey: "supplier-api-key" },
      resolvedIp: "203.0.113.10",
      idempotencyKey: "idem-1",
      payload: { orderNumber: "ORD-1", externalReference: "order-1", lines: [], shippingAddress: null },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("UPSTREAM_UNAVAILABLE");
    }
  });
});

const mockResponse = (
  requestMock: ReturnType<typeof vi.fn>,
  input: { statusCode: number; bodyChunks: Buffer[]; headers?: Record<string, string> },
) => {
  const request = new EventEmitter() as EventEmitter & {
    write: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
  request.write = vi.fn();
  request.destroy = vi.fn((error?: Error) => {
    if (error) {
      request.emit("error", error);
    }
  });
  request.end = vi.fn(() => {
    const response = new EventEmitter() as EventEmitter & {
      statusCode: number;
      headers: Record<string, string>;
    };
    response.statusCode = input.statusCode;
    response.headers = input.headers ?? {};
    const callback = requestMock.mock.calls[0]?.[1] as ((value: typeof response) => void) | undefined;
    callback?.(response);
    for (const chunk of input.bodyChunks) {
      response.emit("data", chunk);
      if (request.destroy.mock.calls.length > 0) {
        return;
      }
    }
    response.emit("end");
  });
  requestMock.mockImplementation(() => request);
  return request;
};
