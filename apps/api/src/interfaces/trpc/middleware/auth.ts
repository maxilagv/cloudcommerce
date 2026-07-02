import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TRPCContext } from "../context.js";

const t = initTRPC.context<TRPCContext>().create({
  errorFormatter({ shape, error }) {
    const cause = error.cause;
    if (cause && typeof cause === "object" && "code" in cause && "status" in cause) {
      return {
        ...shape,
        data: {
          ...shape.data,
          appCode: String(cause.code),
          status: Number(cause.status),
        },
      };
    }
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.actor.kind !== "admin") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Necesitas iniciar sesion." });
  }
  return next({ ctx });
});

export const zodInput = <T extends z.ZodType>(schema: T): T => schema;
