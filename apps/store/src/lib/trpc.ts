import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { trpcTransformer, type inferRouterInputs, type inferRouterOutputs } from "@cloudcommerce/trpc";
import type { AppRouter } from "@cloudcommerce/api/router";

/**
 * The store talks to the main API (apps/api) over HTTP. The customer session
 * travels in an httpOnly cookie (cc_customer_session), so every request uses
 * `credentials: "include"` — the API's CORS is locked to the store origin.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      transformer: trpcTransformer,
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, credentials: "include" }),
      // v11 moved `transformer` onto the link; the runtime accepts it but the
      // published types lag, so we assert the option shape (same as packages/trpc).
    } as unknown as Parameters<typeof httpBatchLink<AppRouter>>[0]),
  ],
});

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
