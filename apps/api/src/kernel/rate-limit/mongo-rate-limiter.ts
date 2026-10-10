import { createHash } from "node:crypto";
import { ERROR_CODE } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { models } from "../db/index.js";
import { AppError } from "../http/index.js";
import type { Clock } from "../time/index.js";
import {
  RATE_LIMIT_COUNTER_MODEL_NAME,
  type RateLimitCounterDocument,
} from "./rate-limit-counter.schema.js";
import type {
  RateLimitDecision,
  RateLimiter,
  RateLimitRequest,
  RateLimitSubject,
} from "./rate-limiter.js";

const MILLISECONDS_PER_SECOND = 1000;
// A counter lives a little past its window, so a clock difference between app and database never drops it early.
const EXPIRY_GRACE_MS = 60 * MILLISECONDS_PER_SECOND;

function hashKey(subject: RateLimitSubject): string {
  return createHash("sha256").update(`${subject.bucket}:${subject.key}`).digest("hex");
}

/**
 * Fixed-window counter in the platform database (14-API.md section 2). One atomic upsert per
 * attempt, so concurrent requests cannot both pass the last slot. Auth traffic is small, which
 * is why Redis is not needed yet.
 */
export class MongoRateLimiter implements RateLimiter {
  constructor(private readonly clock: Clock) {}

  async consume(request: RateLimitRequest): Promise<RateLimitDecision> {
    const windowMs = request.windowSeconds * MILLISECONDS_PER_SECOND;
    const nowMs = this.clock.now().getTime();
    const windowStart = new Date(Math.floor(nowMs / windowMs) * windowMs);
    const windowEndMs = windowStart.getTime() + windowMs;
    const counter = await this.counters()
      .findOneAndUpdate(
        { bucket: request.bucket, keyHash: hashKey(request), windowStart },
        {
          $inc: { count: 1 },
          $setOnInsert: {
            rateLimitCounterId: newId(),
            expiresAt: new Date(windowEndMs + EXPIRY_GRACE_MS),
          },
        },
        { upsert: true, returnDocument: "after" },
      )
      .lean();
    if (counter === null) {
      throw new AppError({
        code: ERROR_CODE.INTERNAL,
        messageKey: "errors.rate_limit_unavailable",
      });
    }
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowEndMs - nowMs) / MILLISECONDS_PER_SECOND),
    );
    return { allowed: counter.count <= request.limit, retryAfterSeconds };
  }

  async reset(subject: RateLimitSubject): Promise<void> {
    await this.counters().deleteMany({ bucket: subject.bucket, keyHash: hashKey(subject) });
  }

  private counters() {
    return models({}).get<RateLimitCounterDocument>(RATE_LIMIT_COUNTER_MODEL_NAME);
  }
}
