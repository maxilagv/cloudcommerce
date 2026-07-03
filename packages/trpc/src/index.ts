import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { initTRPC, type AnyRouter } from "@trpc/server";
import superjson from "superjson";

export type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

export const trpcTransformer = superjson;

type AppErrorCause = {
  code: unknown;
  status: unknown;
};

const isAppErrorCause = (cause: unknown): cause is AppErrorCause =>
  typeof cause === "object" && cause !== null && "code" in cause && "status" in cause;

export const createCloudTRPC = <TContext extends object>() =>
  initTRPC.context<TContext>().create({
    transformer: trpcTransformer,
    errorFormatter({ shape, error }) {
      const cause = error.cause;
      if (isAppErrorCause(cause)) {
        return {
          ...shape,
          data: {
            ...shape.data,
            appCode: String(cause.code),
            status: Number(cause.status),
          },
        };
      }
      if (shape.data.code === "INTERNAL_SERVER_ERROR") {
        return {
          ...shape,
          message: "Ocurrio un error inesperado.",
          data: {
            ...shape.data,
            appCode: "INTERNAL_ERROR",
            status: 500,
          },
        };
      }
      return shape;
    },
  });

export type CreateCloudTRPCClientOptions = {
  url: string;
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
};

export const createCloudTRPCClient = <TRouter extends AnyRouter>(options: CreateCloudTRPCClientOptions) =>
  createTRPCClient<TRouter>({
    links: [
      httpBatchLink({
        url: options.url,
        transformer: trpcTransformer,
        ...(options.headers ? { headers: options.headers } : {}),
      } as unknown as Parameters<typeof httpBatchLink<TRouter>>[0]),
    ],
  });
