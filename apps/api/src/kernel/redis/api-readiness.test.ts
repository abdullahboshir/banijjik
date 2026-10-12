import { Router } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { createLogCapture } from "../../test-support/log-capture.js";
import { createTestConfig } from "../../test-support/test-config.js";
import { connectTestDatabases } from "../../test-support/test-databases.js";
import { describeWithRedis, UNREACHABLE_REDIS_URL } from "../../test-support/test-redis.js";
import type { DatabaseConnections } from "../db/index.js";
import { createLogger } from "../logger/index.js";
import { createCacheRedisClient, type RedisClient } from "./redis-client.js";

let connections: DatabaseConnections;

beforeAll(async () => {
  connections = await connectTestDatabases();
});

afterAll(async () => {
  await connections.close();
});

/** The cache client connects in the background and fails commands until it has; production has long been connected. */
function untilConnected(redis: RedisClient): Promise<void> {
  if (redis.status === "ready") return Promise.resolve();
  return new Promise((resolve) => redis.once("ready", () => resolve()));
}

async function readyAnswerWith(redisUrl: string, options: { waitForRedis: boolean }) {
  const redis = createCacheRedisClient(redisUrl);
  if (options.waitForRedis) await untilConnected(redis);
  const logs = createLogCapture();
  const app = buildApp({
    config: createTestConfig(),
    logger: createLogger({ level: "debug", destination: logs.destination }),
    v1Router: Router(),
    redis,
  });
  const response = await request(app).get("/ready");
  redis.disconnect();
  return response;
}

describeWithRedis("GET /ready in the API role with Redis", (redisUrl) => {
  it("answers 200 with redis ok when both MongoDB and Redis answer", async () => {
    const response = await readyAnswerWith(redisUrl, { waitForRedis: true });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: "ready", details: { redis: "ok" } } });
  });
});

describe("GET /ready in the API role without Redis", () => {
  it("still answers 200 with redis degraded, so a Redis outage does not pull healthy instances out of the load balancer (review M11)", async () => {
    const response = await readyAnswerWith(UNREACHABLE_REDIS_URL, { waitForRedis: false });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: "ready", details: { redis: "degraded" } } });
  });

  it("answers 503 when MongoDB does not answer, whatever Redis says", async () => {
    await connections.close();

    const response = await readyAnswerWith(UNREACHABLE_REDIS_URL, { waitForRedis: false });

    expect(response.status).toBe(503);
    expect(response.body.error).toMatchObject({ code: "INTERNAL", messageKey: "errors.not_ready" });
  });
});
