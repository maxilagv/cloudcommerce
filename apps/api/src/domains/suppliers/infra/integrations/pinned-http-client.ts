import http from "node:http";
import https from "node:https";

type PinnedRequestInput = {
  url: string;
  resolvedIp: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string | undefined;
  timeoutMs: number;
  maxBodyBytes: number;
};

export type PinnedResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
};

export const requestPinned = (input: PinnedRequestInput): Promise<PinnedResponse> =>
  new Promise((resolve, reject) => {
    const url = new URL(input.url);
    const isHttps = url.protocol === "https:";
    const client = isHttps ? https : http;
    const hostHeader = url.port ? `${url.hostname}:${url.port}` : url.hostname;
    const request = client.request(
      {
        protocol: url.protocol,
        hostname: input.resolvedIp,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: input.method,
        headers: {
          ...input.headers,
          host: hostHeader,
        },
        servername: isHttps ? url.hostname : undefined,
        timeout: input.timeoutMs,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let received = 0;
        response.on("data", (chunk: Buffer) => {
          received += chunk.byteLength;
          if (received > input.maxBodyBytes) {
            request.destroy(new Error("response_too_large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    request.on("timeout", () => request.destroy(new Error("request_timeout")));
    request.on("error", reject);
    if (input.body !== undefined) {
      request.write(input.body);
    }
    request.end();
  });
