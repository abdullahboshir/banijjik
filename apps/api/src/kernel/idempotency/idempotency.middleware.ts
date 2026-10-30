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
import { bodyToStore } from "./replay-redaction.js";
import { captureJsonResponse, type CapturedResponse } from "./response-capture.js";

export interface IdempotencyNamespace {
  readonly scopeKind: IdempotencyKeyRef["scopeKind"];
  readonly scopeId: string;
}

export type IdempotencyResolveNamespace = (
  request?: Request,
) => IdempotencyNamespace | Promise<IdempotencyNamespace>;

export interface IdempotencyReplayAuthorization {
  readonly record: StoredIdempotencyRecord;
  readonly body: unknown;
}

export type IdempotencyAuthorizeReplay = (
  authorization: IdempotencyReplayAuthorization,
  request?: Request,
) => Promise<void>;

export interface IdempotencyOptions {
  readonly clock: Clock;
  /** Defaults to the platform-database store. */
  readonly store?: IdempotencyStore;
  readonly resolveNamespace?: IdempotencyResolveNamespace;
  readonly authorizeReplay?: IdempotencyAuthorizeReplay;
}

export type StorefrontIdempotencyOptions = IdempotencyOptions & {
  readonly resolveNamespace: IdempotencyResolveNamespace;
  readonly authorizeReplay: IdempotencyAuthorizeReplay;
};

interface ClaimRequest {
  readonly ref: IdempotencyKeyRef;
  readonly requestHash: string;
}

type Decision =
  | { readonly kind: "RUN" }
  | { readonly kind: "COMPLETED"; readonly record: StoredIdempotencyRecord };

const MAX_CLAIM_ATTEMPTS = 3;
const IN_PROGRESS_RETRY_SECONDS = 1;
const HTTP_SUCCESS_MIN = 200;
const HTTP_SUCCESS_MAX = 299;
export const STOREFRONT_IDEMPOTENCY_CALLBACKS_REQUIRED =
  "Idempotency storefront callbacks must be provided together";

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
function resolveStaffNamespace(): IdempotencyNamespace {
  const { organizationId, userId } = getRequestContext();
  if (organizationId !== undefined) {
    return { scopeKind: IDEMPOTENCY_SCOPE_KIND.ORGANIZATION, scopeId: organizationId };
  }
  if (userId === undefined) throw unauthenticated();
  return { scopeKind: IDEMPOTENCY_SCOPE_KIND.USER, scopeId: userId };
}

async function resolveRequestNamespace(
  resolveNamespace: IdempotencyResolveNamespace | undefined,
  request?: Request,
): Promise<IdempotencyNamespace> {
  if (resolveNamespace !== undefined) return await resolveNamespace(request);
  return resolveStaffNamespace();
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
    if (record.status === IDEMPOTENCY_STATUS.COMPLETED) {
      return { kind: "COMPLETED", record };
    }
    if (record.requestHash !== requestHash) {
      throw new AppError({ code: ERROR_CODE.IDEMPOTENCY_MISMATCH });
    }
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

function parseStoredReplayBody(record: StoredIdempotencyRecord): unknown {
  const text = record.responseBody;
  if (text === undefined) {
    throw new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.internal" });
  }
  try {
    const body: unknown = JSON.parse(text);
    return body;
  } catch (error) {
    throw new AppError({
      code: ERROR_CODE.INTERNAL,
      messageKey: "errors.internal",
      details: { reason: error instanceof Error ? error.name : "invalid_json" },
    });
  }
}

async function authorizeStoredReplay(
  authorizeReplay: IdempotencyAuthorizeReplay | undefined,
  record: StoredIdempotencyRecord,
  request?: Request,
): Promise<void> {
  if (authorizeReplay === undefined) return;
  await authorizeReplay({ record, body: parseStoredReplayBody(record) }, request);
}

function isSuccess(status: number): boolean {
  return status >= HTTP_SUCCESS_MIN && status <= HTTP_SUCCESS_MAX;
}

/** A 2xx answer is stored for replays; anything else frees the key so the client may retry. */
function settleOutcome(
  store: IdempotencyStore,
  claim: ClaimRequest,
  response: Response,
): (captured: CapturedResponse) => Promise<void> {
  return async ({ status, body }) => {
    if (!isSuccess(status)) {
      await store.release(claim.ref, claim.requestHash);
      return;
    }
    await store.complete(claim.ref, {
      status,
      body: JSON.stringify(bodyToStore(response, body) ?? null),
    });
  };
}

function assertPairedCallbacks(options: IdempotencyOptions): void {
  const hasResolve = options.resolveNamespace !== undefined;
  const hasAuthorize = options.authorizeReplay !== undefined;
  if (hasResolve === hasAuthorize) return;
  throw new Error(STOREFRONT_IDEMPOTENCY_CALLBACKS_REQUIRED);
}

/**
 * Makes a `POST` safe to retry (14-API.md section 2, ADR-089). Mount it on the route after
 * `validate()`, so the request hash covers the parsed body. Same key and body: the first answer
 * again, with `Idempotency-Replayed: true`. Same key, other body: `422 IDEMPOTENCY_MISMATCH`.
 * A completed record is authorized before mismatch or replay, so a revoked storefront principal
 * cannot learn that a checkout exists. The record is not part of the business transaction:
 * protection is "at least once, replay after success", and business invariants stay the final
 * guard.
 */
export function createIdempotencyMiddleware(options: IdempotencyOptions): RequestHandler {
  assertPairedCallbacks(options);
  const { clock, store = new MongoIdempotencyStore() } = options;
  return async (request, response, next) => {
    const idempotencyKey = readIdempotencyKey(request);
    const namespace = await resolveRequestNamespace(options.resolveNamespace, request);
    const claim: ClaimRequest = {
      ref: { ...namespace, idempotencyKey },
      requestHash: hashRequest(request),
    };
    const decision = await decide(store, clock, claim);
    if (decision.kind === "COMPLETED") {
      await authorizeStoredReplay(options.authorizeReplay, decision.record, request);
      if (decision.record.requestHash !== claim.requestHash) {
        throw new AppError({ code: ERROR_CODE.IDEMPOTENCY_MISMATCH });
      }
      replay(response, decision.record);
      return;
    }
    captureJsonResponse(response, {
      settle: settleOutcome(store, claim, response),
      fail: next,
      report: (error) => reportError(error, requestErrorContext(request)),
    });
    next();
  };
}

/** Storefront checkout must name both callbacks so replay cannot skip current access. */
export function createStorefrontIdempotencyMiddleware(
  options: StorefrontIdempotencyOptions,
): RequestHandler {
  return createIdempotencyMiddleware(options);
}

function requestErrorContext(request: Request): { requestId?: string; method: string } {
  const requestId = findRequestContext()?.requestId;
  return requestId === undefined
    ? { method: request.method }
    : { requestId, method: request.method };
}
