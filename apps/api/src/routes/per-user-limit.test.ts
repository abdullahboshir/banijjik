import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  RateLimitDecision,
  RateLimiter,
  RateLimitRequest,
} from "../kernel/rate-limit/index.js";
import { asCookies, callApi } from "../test-support/auth-api-client.js";
import { registerViaApi, type RegisteredPerson } from "../test-support/auth-api-scenarios.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../test-support/iam-api-harness.js";
import { createPlatformActor } from "../test-support/platform-world.js";
import {
  createRedisTestScope,
  describeWithRedis,
  type RedisTestScope,
} from "../test-support/test-redis.js";
import { PLATFORM_ROLE } from "@banijjik/contracts";

registerIamApiModels();

/** Remembers every request it was asked to count and refuses the keys it was told to refuse. */
class RecordingLimiter implements RateLimiter {
  readonly requests: RateLimitRequest[] = [];
  readonly refusedKeys = new Set<string>();

  async consume(requested: RateLimitRequest): Promise<RateLimitDecision> {
    this.requests.push(requested);
    return { allowed: !this.refusedKeys.has(requested.key), retryAfterSeconds: 30 };
  }

  async refund(): Promise<void> {}

  async reset(): Promise<void> {}

  forget(): void {
    this.requests.length = 0;
  }
}

const limiter = new RecordingLimiter();
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi({ userRateLimiter: limiter });
});

afterAll(async () => {
  await harness.dispose();
});

function asUser(person: RegisteredPerson, path: string, method: "get" | "post" = "get") {
  return callApi(harness.app, { method, path, cookies: asCookies(person.session) });
}

async function createOrganizationOf(person: RegisteredPerson): Promise<string> {
  const response = await callApi(harness.app, {
    method: "post",
    path: "/api/v1/me/orgs",
    cookies: asCookies(person.session),
    body: {
      name: "Rahim Store",
      slug: `limit-${person.me.userId.slice(-8)}`,
      industryTemplateKey: "RETAIL",
    },
  });
  expect(response.status).toBe(201);
  return response.body.data.organizationId as string;
}

describe("per-user limit on the authenticated API (1.9d, review M8)", () => {
  it("counts /me, /me/orgs and /orgs/* requests against the signed-in user, in the api.user bucket", async () => {
    const person = await registerViaApi(harness.app);
    const organizationId = await createOrganizationOf(person);
    limiter.forget();

    await asUser(person, "/api/v1/me");
    await asUser(person, "/api/v1/me/orgs");
    await asUser(person, `/api/v1/orgs/${organizationId}/audit-logs`);

    expect(limiter.requests.map((requested) => [requested.bucket, requested.key])).toEqual([
      ["api.user", person.me.userId],
      ["api.user", person.me.userId],
      ["api.user", person.me.userId],
    ]);
    expect(limiter.requests[0]).toMatchObject({ limit: 600, windowSeconds: 60 });
  });

  it("answers 429 RATE_LIMITED with Retry-After on every authenticated surface, only for the refused user", async () => {
    const refused = await registerViaApi(harness.app);
    const other = await registerViaApi(harness.app);
    const organizationId = await createOrganizationOf(refused);
    limiter.refusedKeys.add(refused.me.userId);

    const responses = await Promise.all([
      asUser(refused, "/api/v1/me"),
      asUser(refused, "/api/v1/me/orgs"),
      asUser(refused, `/api/v1/orgs/${organizationId}/audit-logs`),
    ]);
    const otherUser = await asUser(other, "/api/v1/me");
    limiter.refusedKeys.delete(refused.me.userId);

    for (const response of responses) {
      expect(response.status).toBe(429);
      expect(response.body.error.code).toBe("RATE_LIMITED");
      expect(response.headers["retry-after"]).toBe("30");
    }
    expect(otherUser.status).toBe(200);
  });

  it("does not count the public auth endpoints or a request that is not signed in", async () => {
    const person = await registerViaApi(harness.app);
    limiter.forget();
    limiter.refusedKeys.add(person.me.userId);

    const login = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/login",
      body: { identifier: person.email, password: person.password },
    });
    const anonymous = await callApi(harness.app, { method: "get", path: "/api/v1/me" });
    limiter.refusedKeys.delete(person.me.userId);

    expect(login.status).toBe(200);
    expect(anonymous.status).toBe(401);
    expect(limiter.requests).toEqual([]);
  });

  it("counts platform requests against the operator, in their own bucket", async () => {
    const operator = await createPlatformActor(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPPORT,
    ]);
    limiter.forget();

    await operator.call("get", "/me");
    limiter.refusedKeys.add(operator.platformOperatorId);
    const refused = await operator.call("get", "/me");
    limiter.refusedKeys.delete(operator.platformOperatorId);

    expect(limiter.requests.map((requested) => [requested.bucket, requested.key])).toEqual([
      ["platform.operator", operator.platformOperatorId],
      ["platform.operator", operator.platformOperatorId],
    ]);
    expect(refused.status).toBe(429);
    expect(refused.body.error.code).toBe("RATE_LIMITED");
  });
});

describeWithRedis("per-user limit with the real Redis limiter (1.9d, review M8)", (redisUrl) => {
  let redisHarness: IamApiHarness;
  let scope: RedisTestScope;

  beforeAll(async () => {
    scope = createRedisTestScope(redisUrl);
    redisHarness = await startIamApi({ redis: scope.client });
  });

  afterAll(async () => {
    await redisHarness.dispose();
    await scope.dispose();
  });

  it("counts an authenticated request in Redis under a hashed user key that expires with the window", async () => {
    const person = await registerViaApi(redisHarness.app);
    const counterKey = `rate-limit:api.user:${createHash("sha256").update(person.me.userId).digest("hex")}`;

    const response = await callApi(redisHarness.app, {
      method: "get",
      path: "/api/v1/me",
      cookies: asCookies(person.session),
    });
    const count = await scope.client.get(counterKey);
    const remainingMs = await scope.client.pttl(counterKey);
    await scope.client.del(counterKey);

    expect(response.status).toBe(200);
    expect(count).toBe("1");
    expect(remainingMs).toBeGreaterThan(0);
    expect(remainingMs).toBeLessThanOrEqual(60_000);
  });
});
