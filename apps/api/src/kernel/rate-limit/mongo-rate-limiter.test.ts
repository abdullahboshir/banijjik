import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { MutableClock } from "../../test-support/mutable-clock.js";
import { createTestApp } from "../../test-support/test-app.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../test-support/test-databases.js";
import { initializeModels, type DatabaseConnections } from "../db/index.js";
import { MongoRateLimiter } from "./mongo-rate-limiter.js";
import { rateLimit } from "./rate-limit.middleware.js";
import {
  RATE_LIMIT_COUNTER_COLLECTION_NAME,
  registerRateLimitModel,
} from "./rate-limit-counter.schema.js";

registerRateLimitModel();

let connections: DatabaseConnections;
const clock = new MutableClock();
const limiter = new MongoRateLimiter(clock);
const LIMIT = { bucket: "test.bucket", limit: 3, windowSeconds: 60 };

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

describe("MongoRateLimiter", () => {
  it("allows up to the limit and then refuses with the seconds left in the window", async () => {
    const key = "limit-case";

    const decisions = [];
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      decisions.push(await limiter.consume({ ...LIMIT, key }));
    }

    expect(decisions.map((decision) => decision.allowed)).toEqual([true, true, true, false]);
    expect(decisions[3]?.retryAfterSeconds).toBeGreaterThan(0);
    expect(decisions[3]?.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("starts a fresh count in the next window", async () => {
    const key = "window-case";
    for (let attempt = 1; attempt <= 4; attempt += 1) await limiter.consume({ ...LIMIT, key });

    clock.advanceSeconds(61);
    const decision = await limiter.consume({ ...LIMIT, key });

    expect(decision.allowed).toBe(true);
  });

  it("counts each key on its own", async () => {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await limiter.consume({ ...LIMIT, key: "busy-key" });
    }

    const decision = await limiter.consume({ ...LIMIT, key: "quiet-key" });

    expect(decision.allowed).toBe(true);
  });

  it("forgets a subject on reset", async () => {
    const key = "reset-case";
    for (let attempt = 1; attempt <= 4; attempt += 1) await limiter.consume({ ...LIMIT, key });

    await limiter.reset({ bucket: LIMIT.bucket, key });
    const decision = await limiter.consume({ ...LIMIT, key });

    expect(decision.allowed).toBe(true);
  });

  it("gives one attempt back on refund and never counts below zero", async () => {
    const key = "refund-case";
    for (let attempt = 1; attempt <= 3; attempt += 1) await limiter.consume({ ...LIMIT, key });

    await limiter.refund({ ...LIMIT, key });
    const afterRefund = await limiter.consume({ ...LIMIT, key });
    const overLimit = await limiter.consume({ ...LIMIT, key });
    await limiter.reset({ bucket: LIMIT.bucket, key });
    await limiter.refund({ ...LIMIT, key });
    const afterEmptyRefund = await limiter.consume({ ...LIMIT, key });

    expect(afterRefund.allowed).toBe(true);
    expect(overLimit.allowed).toBe(false);
    expect(afterEmptyRefund.allowed).toBe(true);
    for (let attempt = 1; attempt < LIMIT.limit; attempt += 1) {
      expect((await limiter.consume({ ...LIMIT, key })).allowed).toBe(true);
    }
    expect((await limiter.consume({ ...LIMIT, key })).allowed).toBe(false);
  });

  it("lets exactly the limit through when requests arrive at the same time", async () => {
    const key = "concurrent-case";

    const decisions = await Promise.all(
      Array.from({ length: 12 }, () => limiter.consume({ ...LIMIT, key })),
    );

    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(LIMIT.limit);
  });

  it("stores the key only as a hash", async () => {
    const secretKey = "someone@example.com";
    await limiter.consume({ ...LIMIT, key: secretKey });

    const stored = await connections.platform
      .collection(RATE_LIMIT_COUNTER_COLLECTION_NAME)
      .find()
      .toArray();

    expect(stored.length).toBeGreaterThan(0);
    expect(JSON.stringify(stored)).not.toContain(secretKey);
  });
});

describe("rateLimit middleware", () => {
  it("answers 429 RATE_LIMITED with Retry-After once the limit is passed", async () => {
    await connections.platform.collection(RATE_LIMIT_COUNTER_COLLECTION_NAME).deleteMany({});
    // MongoDB's TTL monitor uses real time, so a historical clock can lose counters mid-test.
    const middlewareClock = new MutableClock(new Date("2099-10-23T08:00:00.000Z"));
    const middlewareLimiter = new MongoRateLimiter(middlewareClock);
    const { app } = createTestApp((router) => {
      router.get(
        "/limited",
        rateLimit({
          limiter: middlewareLimiter,
          bucket: "test.http.middleware",
          limit: 2,
          windowSeconds: 60,
          keyOf: () => "middleware-subject",
        }),
        (_request, response) => {
          response.json({ data: "ok" });
        },
      );
    });

    const statuses = [];
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      statuses.push((await request(app).get("/api/v1/limited")).status);
    }
    const refused = await request(app).get("/api/v1/limited");

    expect(statuses).toEqual([200, 200, 429]);
    expect(refused.body.error.code).toBe("RATE_LIMITED");
    expect(Number(refused.headers["retry-after"])).toBeGreaterThan(0);
  });
});
