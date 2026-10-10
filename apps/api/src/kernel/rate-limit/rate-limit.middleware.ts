import { ERROR_CODE } from "@banijjik/contracts";
import type { Request, RequestHandler } from "express";
import { AppError } from "../http/index.js";
import type { RateLimiter } from "./rate-limiter.js";

export interface RateLimitMiddlewareOptions {
  readonly limiter: RateLimiter;
  readonly bucket: string;
  readonly limit: number;
  readonly windowSeconds: number;
  /** Who is limited. Defaults to the client IP address. */
  readonly keyOf?: (request: Request) => string;
}

const UNKNOWN_ADDRESS = "unknown";

function clientAddress(request: Request): string {
  return request.ip ?? UNKNOWN_ADDRESS;
}

/** Counts one attempt per request and answers 429 with Retry-After once the limit is passed. */
export function rateLimit(options: RateLimitMiddlewareOptions): RequestHandler {
  const { limiter, bucket, limit, windowSeconds, keyOf = clientAddress } = options;
  return async (request, _response, next) => {
    const decision = await limiter.consume({ bucket, key: keyOf(request), limit, windowSeconds });
    if (!decision.allowed) {
      throw new AppError({
        code: ERROR_CODE.RATE_LIMITED,
        retryAfterSeconds: decision.retryAfterSeconds,
      });
    }
    next();
  };
}
