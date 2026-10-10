import {
  ERROR_CODE,
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_REPLAYED_HEADER,
  IDEMPOTENCY_SCOPE_KIND,
  IDEMPOTENCY_STATUS,
} from "@banijjik/contracts";
import { idempotencyKeySchema } from "@banijjik/validation";
import type { Request, RequestHandler, Response } from "express";
import { findRequestContext, getRequestContext } from "../context/index.js";
import { AppError, unauthenticated, validationFailed } from "../http/index.js";
import { reportError } from "../observability/report-error.js";
import type { Clock } from "../time/index.js";
import {
  MongoIdempotencyStore,
  type IdempotencyKeyRef,
  type IdempotencyStore,
  type StoredIdempotencyRecord,
} from "./idempotency-store.js";
import { computeRequestHash } from "./request-hash.js";
import { captureJsonResponse, type CapturedResponse } from "./response-capture.js";

export interface IdempotencyOptions {
  readonly clock: Clock;
  /** Defaults to the platform-database store. */
  readonly store?: IdempotencyStore;
}

interface ClaimRequest {
  readonly ref: IdempotencyKeyRef;
  readonly requestHash: string;
}

type Decision =
  { readonly kind: "RUN" } | { readonly kind: "REPLAY"; readonly record: StoredIdempotencyRecord };

const MAX_CLAIM_ATTEMPTS = 3;
const IN_PROGRESS_RETRY_SECONDS = 1;
const HTTP_SUCCESS_MIN = 200;
const HTTP_SUCCESS_MAX = 299;

function keyFieldError(messageKey: string): AppError {
  return validationFailed([{ path: IDEMPOTENCY_KEY_HEADER, messageKey }]);
}

/** The header must be present and a UUID (14-API.md section 2). */
function readIdempotencyKey(request: Request): string {
  const header = request.get(IDEMPOTENCY_KEY_HEADER);
  if (header === undefined || header.trim() === "") {
    throw keyFieldError("validation.idempotency_key_required");
  }
  const parsed = idempotencyKeySchema.safeParse(header.trim());
  if (!parsed.success) throw keyFieldError("validation.idempotency_key_invalid");
  return parsed.data;
}

/** A tenant route keys by organization, a user route (`/me/...`) by user: keys never cross either. */
function resolveScope(): Pick<IdempotencyKeyRef, "scopeKind" | "scopeId"> {
  const { organizationId, userId } = getRequestContext();
  if (organizationId !== undefined) {
    return { scopeKind: IDEMPOTENCY_SCOPE_KIND.ORGANIZATION, scopeId: organizationId };
  }
  if (userId === undefined) throw unauthenticated();
  return { scopeKind: IDEMPOTENCY_SCOPE_KIND.USER, scopeId: userId };
}

function hashRequest(request: Request): string {
  // Express types `route` as any; it is only read after the typeof check.
  const routePath: unknown = request.route?.path;
  if (typeof routePath !== "string") {
    throw new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.idempotency_needs_route" });
  }
  return computeRequestHash({
    method: request.method,
    routePattern: `${request.baseUrl}${routePath}`,
    params: request.params,
    body: request.body,
  });
}

function inProgressError(): AppError {
  return new AppError({
    code: ERROR_CODE.CONFLICT,
    messageKey: "errors.idempotency_in_progress",
    retryAfterSeconds: IN_PROGRESS_RETRY_SECONDS,
  });
}

/**
 * Claims the key (the unique index decides races) or says what to do with the existing record:
 * a different request is refused, a finished one is replayed, a running one asks to retry, and a
 * crashed one (lock expired) is taken over.
 */
async function decide(
  store: IdempotencyStore,
  clock: Clock,
  claim: ClaimRequest,
): Promise<Decision> {
  const { ref, requestHash } = claim;
  for (let attempt = 0; attempt < MAX_CLAIM_ATTEMPTS; attempt += 1) {
    const now = clock.now();
    const result = await store.claim(ref, requestHash, now);
    if (result.claimed) return { kind: "RUN" };
    const { record } = result;
    if (record === undefined) continue;
    if (record.requestHash !== requestHash) {
      throw new AppError({ code: ERROR_CODE.IDEMPOTENCY_MISMATCH });
    }
    if (record.status === IDEMPOTENCY_STATUS.COMPLETED) return { kind: "REPLAY", record };
    if (record.lockedUntil > now) throw inProgressError();
    if (await store.reclaim(ref, requestHash, now)) return { kind: "RUN" };
  }
  throw inProgressError();
}

function replay(response: Response, record: StoredIdempotencyRecord): void {
  response.setHeader(IDEMPOTENCY_REPLAYED_HEADER, "true");
  response.status(record.responseStatus ?? HTTP_SUCCESS_MIN);
  response.type("application/json").send(record.responseBody ?? "null");
}

function isSuccess(status: number): boolean {
  return status >= HTTP_SUCCESS_MIN && status <= HTTP_SUCCESS_MAX;
}

/** A 2xx answer is stored for replays; anything else frees the key so the client may retry. */
function settleOutcome(
  store: IdempotencyStore,
  claim: ClaimRequest,
): (captured: CapturedResponse) => Promise<void> {
  return async ({ status, body }) => {
    if (!isSuccess(status)) {
      await store.release(claim.ref, claim.requestHash);
      return;
    }
    await store.complete(claim.ref, { status, body: JSON.stringify(body ?? null) });
  };
}

/**
 * Makes a `POST` safe to retry (14-API.md section 2, ADR-089). Mount it on the route after
 * `validate()`, so the request hash covers the parsed body. Same key and body: the first answer
 * again, with `Idempotency-Replayed: true`. Same key, other body: `422 IDEMPOTENCY_MISMATCH`.
 * The record is not part of the business transaction: protection is "at least once, replay
 * after success", and business invariants stay the final guard.
 */
export function createIdempotencyMiddleware(options: IdempotencyOptions): RequestHandler {
  const { clock, store = new MongoIdempotencyStore() } = options;
  return async (request, response, next) => {
    const idempotencyKey = readIdempotencyKey(request);
    const claim: ClaimRequest = {
      ref: { ...resolveScope(), idempotencyKey },
      requestHash: hashRequest(request),
    };
    const decision = await decide(store, clock, claim);
    if (decision.kind === "REPLAY") {
      replay(response, decision.record);
      return;
    }
    captureJsonResponse(response, {
      settle: settleOutcome(store, claim),
      fail: next,
      report: (error) => reportError(error, requestErrorContext(request)),
    });
    next();
  };
}

function requestErrorContext(request: Request): { requestId?: string; method: string } {
  const requestId = findRequestContext()?.requestId;
  return requestId === undefined
    ? { method: request.method }
    : { requestId, method: request.method };
}
