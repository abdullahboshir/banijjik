import { ERROR_CODE } from "@banijjik/contracts";
import { pino, type DestinationStream, type Logger } from "pino";
import type { AppConfig } from "../../config/index.js";
import { findRequestContext } from "../context/request-context.js";
import { AppError } from "../http/app-error.js";

export type { Logger } from "pino";

export interface CreateLoggerOptions {
  readonly level: AppConfig["logLevel"];
  /** Tests pass a capture stream. Production writes JSON to stdout. */
  readonly destination?: DestinationStream;
}

const SERVICE_NAME = "api";
const REDACTED_VALUE = "[redacted]";

// 05-CONVENTIONS: secrets, phone and email never reach a log line.
export const REDACT_PATHS: readonly string[] = [
  "password",
  "*.password",
  "token",
  "*.token",
  "*.secret",
  "authorization",
  "cookie",
  "*.phoneE164",
  "*.email",
  // Two levels deep, for shapes such as body.contact.email and err.details.phoneE164.
  "*.*.phoneE164",
  "*.*.email",
  "*.*.password",
  "*.*.token",
  "req.headers.authorization",
  "req.headers.cookie",
  // Defence in depth for review finding B1: the access log keeps no headers, but a future serializer might.
  'req.headers["set-cookie"]',
  'res.headers["set-cookie"]',
];

export function createLogger(options: CreateLoggerOptions): Logger {
  const settings = {
    level: options.level,
    base: { service: SERVICE_NAME },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: [...REDACT_PATHS], censor: REDACTED_VALUE },
  };
  return options.destination === undefined ? pino(settings) : pino(settings, options.destination);
}

let rootLogger: Logger | undefined;

/** Called once by buildApp. It is the only module-level logger; everything else asks getLogger(). */
export function setRootLogger(logger: Logger): void {
  rootLogger = logger;
}

/** The request-scoped child inside a request, the root logger outside one. */
export function getLogger(): Logger {
  if (rootLogger === undefined) {
    throw new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.logger_not_initialized" });
  }
  const context = findRequestContext();
  if (context === undefined) return rootLogger;
  return rootLogger.child({
    requestId: context.requestId,
    ...(context.organizationId === undefined ? {} : { organizationId: context.organizationId }),
    ...(context.userId === undefined ? {} : { userId: context.userId }),
  });
}
