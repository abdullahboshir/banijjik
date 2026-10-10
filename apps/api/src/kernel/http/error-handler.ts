import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { ERROR_CODE } from "@banijjik/contracts";
import { findRequestContext } from "../context/index.js";
import { reportError } from "../observability/report-error.js";
import { AppError, validationFailed } from "./app-error.js";
import { REQUEST_ID_HEADER } from "./request-id.middleware.js";

const INVALID_JSON_FIELD = { path: "", messageKey: "errors.invalid_json" };
const PAYLOAD_TOO_LARGE_FIELD = { path: "", messageKey: "errors.payload_too_large" };

function readBodyParserErrorType(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("type" in error)) return undefined;
  return typeof error.type === "string" ? error.type : undefined;
}

/** Maps body-parser failures to client errors; returns undefined for anything else. */
function toClientError(error: unknown): AppError | undefined {
  if (error instanceof AppError) return error;
  const bodyParserType = readBodyParserErrorType(error);
  if (bodyParserType === "entity.parse.failed") return validationFailed([INVALID_JSON_FIELD]);
  if (bodyParserType === "entity.too.large") return validationFailed([PAYLOAD_TOO_LARGE_FIELD]);
  return undefined;
}

function readRequestId(response: Response): string {
  const fromContext = findRequestContext()?.requestId;
  if (fromContext !== undefined) return fromContext;
  return String(response.getHeader(REQUEST_ID_HEADER) ?? "");
}

function sendError(response: Response, error: AppError): void {
  const body = {
    error: {
      code: error.code,
      messageKey: error.messageKey,
      ...(error.details === undefined ? {} : { details: error.details }),
      requestId: readRequestId(response),
    },
  };
  response.status(error.httpStatus).json(body);
}

function toInternalError(error: unknown, request: Request, response: Response): AppError {
  reportError(error, {
    requestId: readRequestId(response),
    method: request.method,
    path: request.path,
  });
  return new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.internal" });
}

const EXPRESS_ERROR_HANDLER_ARITY = 4;

function handleError(
  error: unknown,
  ...[request, response, next]: [Request, Response, NextFunction]
): void {
  if (response.headersSent) {
    next(error);
    return;
  }
  const clientError = toClientError(error) ?? toInternalError(error, request, response);
  sendError(response, clientError);
}

/**
 * Mounted last. The only code that writes an error body, and it never copies a message or stack into it.
 * Express recognises an error handler by `function.length === 4`. The lint rule max-params (3) forbids
 * declaring four parameters, so the arity is set explicitly instead of weakening the rule.
 */
export const errorHandler: ErrorRequestHandler = Object.defineProperty(handleError, "length", {
  value: EXPRESS_ERROR_HANDLER_ARITY,
});
