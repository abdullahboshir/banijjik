import type { RequestHandler } from "express";
import { AppError } from "../../../../kernel/http/index.js";
import { DomainRuleError } from "../domain/errors.js";

/** Turns an organization rule failure into the API error the kernel error handler understands. */
export function toAppError(error: DomainRuleError): AppError {
  return new AppError({
    code: error.code,
    messageKey: error.messageKey,
    ...(error.details === undefined ? {} : { details: error.details }),
  });
}

/** The domain imports no kernel, so this is the one place its errors become API errors. */
export function translateDomainErrors(handler: RequestHandler): RequestHandler {
  return async (request, response, next) => {
    try {
      await handler(request, response, next);
    } catch (error) {
      throw error instanceof DomainRuleError ? toAppError(error) : error;
    }
  };
}
