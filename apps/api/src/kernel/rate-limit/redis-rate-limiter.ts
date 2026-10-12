import { createHash } from "node:crypto";
import type { RedisClient } from "../redis/index.js";
import type {
  RateLimitDecision,
  RateLimiter,
  RateLimitRequest,
  RateLimitSubject,
} from "./rate-limiter.js";

const MILLISECONDS_PER_SECOND = 1000;
const DEFAULT_KEY_PREFIX = "rate-limit";

/**
 * One round trip, atomic: count the attempt and start the window on the first one. The window then
 * ends by itself when the key expires. A key without a time to live would lock its owner out for
 * good, so a missing one is repaired here.
 */
const CONSUME_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local remaining = redis.call('PTTL', KEYS[1])
if remaining < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  remaining = tonumber(ARGV[1])
end
return {count, remaining}
`;

const REFUND_SCRIPT = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count > 0 then redis.call('DECR', KEYS[1]) end
return count
`;

export interface RedisRateLimiterOptions {
  readonly client: RedisClient;
  /** Put in front of every key, so a test can clean up only its own counters. */
  readonly keyPrefix?: string;
}

function isConsumeReply(reply: unknown): reply is [number, number] {
  return (
    Array.isArray(reply) &&
    reply.length === 2 &&
    typeof reply[0] === "number" &&
    typeof reply[1] === "number"
  );
}

/**
 * Fixed-window counter in Redis, for limits that are checked on every request (the per-user limit
 * of the authenticated API). It throws when Redis does not answer; the caller decides what an
 * unavailable limiter means (the per-user middleware lets the request through).
 */
export class RedisRateLimiter implements RateLimiter {
  private readonly keyPrefix: string;

  constructor(private readonly options: RedisRateLimiterOptions) {
    this.keyPrefix = options.keyPrefix ?? DEFAULT_KEY_PREFIX;
  }

  async consume(request: RateLimitRequest): Promise<RateLimitDecision> {
    const windowMs = request.windowSeconds * MILLISECONDS_PER_SECOND;
    const reply = await this.options.client.eval(
      CONSUME_SCRIPT,
      1,
      this.redisKey(request),
      String(windowMs),
    );
    if (!isConsumeReply(reply)) throw new Error("unexpected reply from the rate-limit script");
    const [count, remainingMs] = reply;
    return {
      allowed: count <= request.limit,
      retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / MILLISECONDS_PER_SECOND)),
    };
  }

  async refund(request: RateLimitRequest): Promise<void> {
    await this.options.client.eval(REFUND_SCRIPT, 1, this.redisKey(request));
  }

  async reset(subject: RateLimitSubject): Promise<void> {
    await this.options.client.del(this.redisKey(subject));
  }

  /** The caller's key is hashed, so an identifier never sits in Redis in clear text. */
  private redisKey(subject: RateLimitSubject): string {
    const hash = createHash("sha256").update(subject.key).digest("hex");
    return `${this.keyPrefix}:${subject.bucket}:${hash}`;
  }
}
