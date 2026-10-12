import type { Request, RequestHandler } from "express";
import { Router } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { createLogger } from "./kernel/logger/index.js";
import { rateLimit } from "./kernel/rate-limit/index.js";
import type {
  RateLimitDecision,
  RateLimiter,
  RateLimitRequest,
} from "./kernel/rate-limit/index.js";
import { createLogCapture } from "./test-support/log-capture.js";
import { createTestConfig } from "./test-support/test-config.js";

class KeyRecordingLimiter implements RateLimiter {
  readonly keys: string[] = [];

  async consume(requested: RateLimitRequest): Promise<RateLimitDecision> {
    this.keys.push(requested.key);
    return { allowed: true, retryAfterSeconds: 1 };
  }

  async refund(): Promise<void> {}

  async reset(): Promise<void> {}
}

function limitedRouter(limiter: RateLimiter): Router {
  const router = Router();
  const handler: RequestHandler = (_request: Request, response) => {
    response.json({ data: "ok" });
  };
  router.get(
    "/limited",
    rateLimit({ limiter, bucket: "test.proxy", limit: 5, windowSeconds: 60 }),
    handler,
  );
  return router;
}

async function keyOfRequestWith(hops: string, forwardedFor: string): Promise<string | undefined> {
  const limiter = new KeyRecordingLimiter();
  const logs = createLogCapture();
  const app = buildApp({
    config: createTestConfig({ TRUSTED_PROXY_HOPS: hops }),
    logger: createLogger({ level: "debug", destination: logs.destination }),
    v1Router: limitedRouter(limiter),
  });

  await request(app).get("/api/v1/limited").set("X-Forwarded-For", forwardedFor);

  return limiter.keys[0];
}

describe("proxy trust (1.9d, review M7)", () => {
  it("ignores X-Forwarded-For when no proxy is trusted, so a forged header cannot pick the rate-limit key", async () => {
    const forged = await keyOfRequestWith("0", "203.0.113.9");
    const other = await keyOfRequestWith("0", "203.0.113.77");

    expect(forged).not.toBe("203.0.113.9");
    expect(forged).toBe(other);
  });

  it("takes the address the last trusted proxy saw when one hop is trusted, not an earlier forged entry", async () => {
    const key = await keyOfRequestWith("1", "203.0.113.9, 198.51.100.7");

    expect(key).toBe("198.51.100.7");
  });
});
