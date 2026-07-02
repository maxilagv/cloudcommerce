import type { FastifyReply, FastifyRequest } from "fastify";
import { v7 as uuidv7 } from "uuid";

export const requestIdHeader = "x-request-id";

export const resolveRequestId = (request: FastifyRequest): string => {
  const header = request.headers[requestIdHeader];
  if (typeof header === "string" && header.trim().length > 0) {
    return header.trim();
  }
  return `req_${uuidv7()}`;
};

export const attachRequestId = (reply: FastifyReply, requestId: string): void => {
  reply.header("X-Request-Id", requestId);
};
