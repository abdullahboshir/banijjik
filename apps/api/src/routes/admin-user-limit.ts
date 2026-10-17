import { requireCurrentUserId } from "../kernel/auth/index.js";
import { PER_USER_LIMIT, perUserLimit, type RateLimiter } from "../kernel/rate-limit/index.js";
import type { Clock } from "../kernel/time/index.js";
import type { RequestHandler } from "express";

/** The per-user limit of business users: none without a limiter, otherwise one handler. */
export function buildAdminUserLimit(dependencies: {
  readonly userRateLimiter?: RateLimiter;
  readonly clock: Clock;
}): readonly RequestHandler[] {
  const { userRateLimiter, clock } = dependencies;
  if (userRateLimiter === undefined) return [];
  return [
    perUserLimit({
      limiter: userRateLimiter,
      clock,
      ...PER_USER_LIMIT.ADMIN_USER,
      userKeyOf: requireCurrentUserId,
    }),
  ];
}
