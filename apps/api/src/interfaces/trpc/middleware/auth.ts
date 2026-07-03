import { createCloudTRPC } from "@cloudcommerce/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TRPCContext } from "../context.js";

const t = createCloudTRPC<TRPCContext>();

export const router = t.router;
export const publicProcedure = t.procedure;

export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.actor.kind !== "admin") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Necesitas iniciar sesion." });
  }
  return next({ ctx });
});

export const zodInput = <T extends z.ZodType>(schema: T): T => schema;
