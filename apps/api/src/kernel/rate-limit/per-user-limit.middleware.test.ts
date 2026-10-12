import { Router } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { MutableClock } from "../../test-support/mutable-clock.js";
import { createTestApp } from "../../test-support/test-app.js";
import { createCacheRedisClient } from "../redis/index.js";
import { UNREACHABLE_REDIS_URL } from "../../test-support/test-redis.js";
import { perUserLimit } from "./per-user-limit.middleware.js";
import { RedisRateLimiter } from "./redis-rate-limiter.js";
import type { RateLimitDecision, RateLimiter, RateLimitRequest } from "./rate-limiter.js";

const LIMIT = { bucket: "test.user", limit: 600, windowSeconds: 60 };
const SECONDS_PER_MINUTE = 60;

class ScriptedLimiter implements RateLimiter {
  readonly requests: RateLimitRequest[] = [];

  constructor(private readonly answer: () => Promise<RateLimitDecision>) {}

  consume(requested: RateLimitRequest): Promise<RateLimitDecision> {
    this.requests.push(requested);
    return this.answer();
  }

  async refund(): Promise<void> {}

  async reset(): Promise<void> {}
}

function appWith(limiter: RateLimiter, clock = new MutableClock()) {
  return createTestApp((router: Router) => {
    router.get(
      "/limited",
      perUserLimit({ limiter, clock, ...LIMIT, userKeyOf: () => "user-1" }),
      (_request, response) => {
        response.json({ data: "ok" });
      },
    );
  });
}

const allowed = async (): Promise<RateLimitDecision> => ({ allowed: true, retryAfterSeconds: 1 });
const unavailable = async (): Promise<RateLimitDecision> => {
  throw new Error("redis is away");
};

describe("perUserLimit", () => {
  it("counts the request against the user key in its bucket", async () => {
    const limiter = new ScriptedLimiter(allowed);
    const { app } = appWith(limiter);

    const response = await request(app).get("/api/v1/limited");

    expect(response.status).toBe(200);
    expect(limiter.requests).toEqual([{ ...LIMIT, key: "user-1" }]);
  });

  it("answers 429 RATE_LIMITED with Retry-After once the user is over the limit", async () => {
    const limiter = new ScriptedLimiter(async () => ({ allowed: false, retryAfterSeconds: 42 }));
    const { app } = appWith(limiter);

    const response = await request(app).get("/api/v1/limited");

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe("RATE_LIMITED");
    expect(response.headers["retry-after"]).toBe("42");
  });

  it("lets the request through when the limiter is unavailable, instead of taking the API down", async () => {
    const { app } = appWith(new ScriptedLimiter(unavailable));

    const response = await request(app).get("/api/v1/limited");

    expect(response.status).toBe(200);
  });

  it("lets the request through when the real Redis limiter cannot reach Redis", async () => {
    const client = createCacheRedisClient(UNREACHABLE_REDIS_URL);
    const { app } = appWith(new RedisRateLimiter({ client }));

    const response = await request(app).get("/api/v1/limited");
    client.disconnect();

    expect(response.status).toBe(200);
  });

  it("logs the outage at most once a minute", async () => {
    const clock = new MutableClock();
    const { app, logs } = appWith(new ScriptedLimiter(unavailable), clock);
    const outageLines = () =>
      logs.lines().filter((line) => line["event"] === "rate_limit.unavailable");

    await request(app).get("/api/v1/limited");
    await request(app).get("/api/v1/limited");
    const afterFirstMinute = outageLines().length;
    clock.advanceSeconds(SECONDS_PER_MINUTE + 1);
    await request(app).get("/api/v1/limited");

    expect(afterFirstMinute).toBe(1);
    expect(outageLines()).toHaveLength(2);
    expect(outageLines()[0]?.["level"]).toBe(40);
    expect(logs.text()).not.toContain("redis is away");
  });
});
