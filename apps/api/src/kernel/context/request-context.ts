import { AsyncLocalStorage } from "node:async_hooks";
import { ERROR_CODE } from "@banijjik/contracts";
import { AppError } from "../http/app-error.js";

export interface RequestContext {
  readonly requestId: string;
  readonly userId?: string;
  readonly organizationId?: string;
  readonly allowedLocationIds?: readonly string[] | "ALL";
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Contexts are immutable: later cards pass `{ ...current, organizationId }` to a nested call. */
export function runWithRequestContext<Result>(context: RequestContext, work: () => Result): Result {
  return storage.run(context, work);
}

export function findRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function getRequestContext(): RequestContext {
  const context = storage.getStore();
  if (context === undefined) {
    throw new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.missing_request_context" });
  }
  return context;
}
