import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { DomainRuleError, ERROR_CODE, type ApiErrorEnvelope } from "@banijjik/contracts";
import { findRequestContext } from "../context/index.js";
import { getLogger, maskSecretPathSegments } from "../logger/index.js";
import { reportError } from "../observability/report-error.js";
import { AppError, validationFailed } from "./app-error.js";
import { readRequestId as readRequestIdHeader } from "./request-id.middleware.js";

const INVALID_JSON_FIELD = { path: "", messageKey: "errors.invalid_json" };
const PAYLOAD_TOO_LARGE_FIELD = { path: "", messageKey: "errors.payload_too_large" };
const INVALID_BODY_FIELD = { path: "", messageKey: "errors.invalid_body" };

const CLIENT_ERROR_MIN_STATUS = 400;
const CLIENT_ERROR_MAX_STATUS = 499;
const SERVER_ERROR_MIN_STATUS = 500;
const RETRY_AFTER_SECONDS = "1";

interface BodyParserError {
  readonly type: string;
}

/** body-parser errors carry a string `type` and an HTTP status; both are checked so other errors stay INTERNAL. */
function asBodyParserClientError(error: unknown): BodyParserError | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  // Safe: the object is only read for the three fields below, each checked with typeof before use.
  const { type, status, statusCode } = error as Record<string, unknown>;
  if (typeof type !== "string") return undefined;
  const httpStatus = typeof status === "number" ? status : statusCode;
  if (typeof httpStatus !== "number") return undefined;
  const isClientError =
    httpStatus >= CLIENT_ERROR_MIN_STATUS && httpStatus <= CLIENT_ERROR_MAX_STATUS;
  return isClientError ? { type } : undefined;
}

function messageKeyForBodyError(type: string): string {
  if (type === "entity.parse.failed") return INVALID_JSON_FIELD.messageKey;
  if (type === "entity.too.large") return PAYLOAD_TOO_LARGE_FIELD.messageKey;
  return INVALID_BODY_FIELD.messageKey;
}

/**
 * A server-side AppError is a programming fault (unknown model, missing transaction, ...). It is
 * reported with its stack and answered as the generic INTERNAL, so no internal name reaches the
 * client (review finding J1). RETRY_LATER is the one deliberate 5xx: the client may retry.
 */
function isUnexpectedServerError(error: AppError): boolean {
  return error.httpStatus >= SERVER_ERROR_MIN_STATUS && error.code !== ERROR_CODE.RETRY_LATER;
}

/** A domain rule failure is answered exactly like an AppError with the same code, key and details (ADR-086). */
function fromDomainRuleError(error: DomainRuleError): AppError {
  return new AppError({
    code: error.code,
    messageKey: error.messageKey,
    ...(error.details === undefined ? {} : { details: error.details }),
    ...(error.retryAfterSeconds === undefined
      ? {}
      : { retryAfterSeconds: error.retryAfterSeconds }),
  });
}

/** Maps body-parser failures to client errors; returns undefined for anything else. */
function toClientError(error: unknown): AppError | undefined {
  if (error instanceof DomainRuleError) return toClientError(fromDomainRuleError(error));
  if (error instanceof AppError) return isUnexpectedServerError(error) ? undefined : error;
  const bodyError = asBodyParserClientError(error);
  if (bodyError === undefined) return undefined;
  // An aborted upload is the client's doing: a warning, not an unexpected failure.
  if (bodyError.type === "request.aborted")
    getLogger().warn({ event: "request.aborted" }, "client aborted the request");
  return validationFailed([{ path: "", messageKey: messageKeyForBodyError(bodyError.type) }]);
}

function readRequestId(response: Response): string {
  const fromContext = findRequestContext()?.requestId;
  if (fromContext !== undefined) return fromContext;
  return readRequestIdHeader(response);
}

/** RETRY_LATER always asks for one second; other errors (429) name their own wait. */
function readRetryAfter(error: AppError): string | undefined {
  if (error.retryAfterSeconds !== undefined) return String(error.retryAfterSeconds);
  return error.code === ERROR_CODE.RETRY_LATER ? RETRY_AFTER_SECONDS : undefined;
}

function sendError(response: Response, error: AppError): void {
  const body: ApiErrorEnvelope = {
    error: {
      code: error.code,
      messageKey: error.messageKey,
      ...(error.details === undefined ? {} : { details: error.details }),
      requestId: readRequestId(response),
    },
  };
  const retryAfter = readRetryAfter(error);
  if (retryAfter !== undefined) response.setHeader("Retry-After", retryAfter);
  response.status(error.httpStatus).json(body);
}

function toInternalError(error: unknown, request: Request, response: Response): AppError {
  reportError(error, {
    requestId: readRequestId(response),
    method: request.method,
    path: maskSecretPathSegments(request.path),
  });
  return new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.internal" });
}

function handleError(
  error: unknown,
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (response.headersSent) {
    next(error);
    return;
  }
  const clientError = toClientError(error) ?? toInternalError(error, request, response);
  sendError(response, clientError);
}

/** Mounted last. The only code that writes an error body, and it never copies a message or stack into it. */
export const errorHandler: ErrorRequestHandler = handleError;
