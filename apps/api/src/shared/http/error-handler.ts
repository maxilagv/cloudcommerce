import { ZodError } from "zod";
import { AppError, errorTitles } from "../errors/app-error.js";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export const globalErrorHandler = (error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply): void => {
  const requestId = request.requestId;
  const appError =
    error instanceof AppError
      ? error
      : error instanceof ZodError
        ? new AppError({
            code: "VALIDATION_FAILED",
            status: 400,
            message: "Algunos campos no son validos.",
            details: error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
              code: issue.code,
            })),
          })
        : new AppError({ code: "INTERNAL_ERROR", status: 500, message: "Ocurrio un error inesperado." });

  if (appError.status >= 500) {
    request.log.error({ err: error, requestId, errorCode: appError.code }, "Unhandled request error");
  } else {
    request.log.warn({ requestId, errorCode: appError.code }, appError.message);
  }

  reply.status(appError.status).send({
    type: `https://api.cloudcommerce.local/errors/${appError.code.toLowerCase()}`,
    title: errorTitles[appError.code],
    status: appError.status,
    code: appError.code,
    message: appError.message,
    requestId,
    ...(appError.details ? { details: appError.details } : {}),
  });
};
