import {
  DownloadDocumentSchema,
  FinanceKpisQuerySchema,
  FinancePeriodReportQuerySchema,
  GenerateDocumentSchema,
  GetDocumentSchema,
  ListDocumentsSchema,
  RecomputePeriodSnapshotSchema,
  RegenerateDocumentSchema,
} from "@cloudcommerce/validators";
import { adminProcedure, router } from "../../../interfaces/trpc/middleware/auth.js";
import type { FinanceDomainError } from "../../../shared/errors/domain-error.js";
import { appErrorToTrpcError, financeErrorToAppError } from "../../../shared/errors/http-error.js";

const throwFinance = (error: FinanceDomainError): never => {
  throw appErrorToTrpcError(financeErrorToAppError(error));
};

const requestContext = (
  ctx: { ip: string; userAgent: string; requestId: string; request: { headers: Record<string, unknown> } },
  reason?: string | null,
) => ({
  ip: ctx.ip,
  userAgent: ctx.userAgent,
  requestId: ctx.requestId,
  reason: reason ?? null,
  idempotencyKey: readHeader(ctx.request.headers["idempotency-key"]),
});

export const financeRouter = router({
  generateDocument: adminProcedure.input(GenerateDocumentSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.finance.generateDocument(ctx.actor, input, requestContext(ctx));
    if (!result.ok) {
      return throwFinance(result.error);
    }
    return result.value;
  }),

  regenerateDocument: adminProcedure.input(RegenerateDocumentSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.finance.regenerateDocument(ctx.actor, input);
    if (!result.ok) {
      return throwFinance(result.error);
    }
    return result.value;
  }),

  getDocument: adminProcedure.input(GetDocumentSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.finance.getDocument(ctx.actor, input);
    if (!result.ok) {
      return throwFinance(result.error);
    }
    return result.value;
  }),

  listDocuments: adminProcedure.input(ListDocumentsSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.finance.listDocuments(ctx.actor, input);
    if (!result.ok) {
      return throwFinance(result.error);
    }
    return result.value;
  }),

  getDocumentDownloadUrl: adminProcedure.input(DownloadDocumentSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.finance.getDocumentDownloadUrl(ctx.actor, input, requestContext(ctx, input.reason));
    if (!result.ok) {
      return throwFinance(result.error);
    }
    return result.value;
  }),

  getPeriodReport: adminProcedure.input(FinancePeriodReportQuerySchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.finance.getPeriodReport(ctx.actor, input);
    if (!result.ok) {
      return throwFinance(result.error);
    }
    return result.value;
  }),

  getKpis: adminProcedure.input(FinanceKpisQuerySchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.finance.getKpis(ctx.actor, input);
    if (!result.ok) {
      return throwFinance(result.error);
    }
    return result.value;
  }),

  recomputePeriodSnapshot: adminProcedure.input(RecomputePeriodSnapshotSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.finance.recomputePeriodSnapshot(ctx.actor, input);
    if (!result.ok) {
      return throwFinance(result.error);
    }
    return result.value;
  }),
});

const readHeader = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim().length > 0) {
    return value[0].trim();
  }
  return null;
};
