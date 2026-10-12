import { ERROR_CODE } from "@banijjik/contracts";
import type { RequestHandler } from "express";
import { AppError } from "../http/index.js";
import { getLogger } from "../logger/index.js";
import type { Clock } from "../time/index.js";
import type { RateLimitDecision, RateLimiter } from "./rate-limiter.js";

const OUTAGE_LOG_INTERVAL_MS = 60_000;

export interface PerUserLimitOptions {
  readonly limiter: RateLimiter;
  readonly clock: Clock;
  readonly bucket: string;
  readonly limit: number;
  readonly windowSeconds: number;
  /** Who is limited. Throws 401 when the request is not signed in, so it runs after authentication. */
  readonly userKeyOf: () => string;
}

/**
 * The generous per-user limit of the authenticated API (review M8): a runaway client or a stolen
 * session cannot hammer one user's endpoints without end. It runs on every request, so it must stay
 * cheap, and abuse protection must never take the API down: when the limiter cannot answer, the
 * request goes through and the outage is logged, at most once a minute.
 */
export function perUserLimit(options: PerUserLimitOptions): RequestHandler {
  const { limiter, clock, bucket, limit, windowSeconds, userKeyOf } = options;
  let lastOutageLogAtMs = Number.NEGATIVE_INFINITY;

  function logOutage(error: unknown): void {
    const nowMs = clock.now().getTime();
    if (nowMs - lastOutageLogAtMs < OUTAGE_LOG_INTERVAL_MS) return;
    lastOutageLogAtMs = nowMs;
    // Name only: a client message can contain the connection URL.
    const errorName = error instanceof Error ? error.name : "UnknownError";
    getLogger().warn(
      { event: "rate_limit.unavailable", bucket, errorName },
      "per-user rate limit unavailable, requests pass without it",
    );
  }

  async function consumeOrLetThrough(key: string): Promise<RateLimitDecision | undefined> {
    try {
      return await limiter.consume({ bucket, key, limit, windowSeconds });
    } catch (error) {
      logOutage(error);
      return undefined;
    }
  }

  return async (_request, _response, next) => {
    const decision = await consumeOrLetThrough(userKeyOf());
    if (decision !== undefined && !decision.allowed) {
      throw new AppError({
        code: ERROR_CODE.RATE_LIMITED,
        retryAfterSeconds: decision.retryAfterSeconds,
      });
    }
    next();
  };
}
