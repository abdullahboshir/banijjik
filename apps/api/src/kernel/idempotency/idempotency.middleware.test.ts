import { IDEMPOTENCY_KEY_HEADER, IDEMPOTENCY_REPLAYED_HEADER } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import type { Response, Router } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { MutableClock } from "../../test-support/mutable-clock.js";
import { createTestApp, type TestApp } from "../../test-support/test-app.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../test-support/test-databases.js";
import { runWithRequestContext } from "../context/index.js";
import { initializeModels, type DatabaseConnections } from "../db/index.js";
import { sendData, validate } from "../http/index.js";
import { createIdempotencyMiddleware } from "./idempotency.middleware.js";
import { registerIdempotencyModel } from "./idempotency-record.schema.js";

registerIdempotencyModel();

const probeBodySchema = z.looseObject({ mode: z.string().default("ok") });
const USER_HEADER = "x-test-user";
const ORGANIZATION_HEADER = "x-test-organization";
const REPLAYED = IDEMPOTENCY_REPLAYED_HEADER.toLowerCase();
const DEFAULT_USER_ID = newId();
const SLOW_MILLISECONDS = 200;
const LOCK_SECONDS_PLUS_ONE = 61;

let connections: DatabaseConnections;
let clock: MutableClock;
let probe: TestApp;
let handlerRuns = 0;
const heldRequests: (() => void)[] = [];

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function holdUntilReleased(): Promise<void> {
  return new Promise((resolve) => {
    heldRequests.push(resolve);
  });
}

async function runMode(mode: string, response: Response): Promise<boolean> {
  if (mode === "slow") await sleep(SLOW_MILLISECONDS);
  if (mode === "hold") await holdUntilReleased();
  if (mode === "rejected") {
    response.status(422).json({ error: { code: "BUSINESS_RULE" } });
    return true;
  }
  if (mode === "crash") throw new Error("injected crash");
  if (mode === "raw-send") {
    response.send("not json");
    return true;
  }
  return false;
}

function buildProbeRouter(router: Router): void {
  // Stands in for authenticate() and tenantContext(): the caller comes from test headers.
  router.use((incoming, _response, next) => {
    const organizationId = incoming.get(ORGANIZATION_HEADER);
    runWithRequestContext(
      {
        requestId: newId(),
        userId: incoming.get(USER_HEADER) ?? DEFAULT_USER_ID,
        ...(organizationId === undefined ? {} : { organizationId }),
      },
      () => next(),
    );
  });
  const idempotency = createIdempotencyMiddleware({ clock });
  for (const path of ["/probe", "/probe-two"]) {
    router.post(
      path,
      validate({ body: probeBodySchema }),
      idempotency,
      async (incoming, response) => {
        handlerRuns += 1;
        const { mode } = incoming.body as { mode: string };
        if (await runMode(mode, response)) return;
        sendData(response, { run: handlerRuns }, { status: 201 });
      },
    );
  }
}

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
  clock = new MutableClock(new Date());
  probe = createTestApp(buildProbeRouter);
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

beforeEach(() => {
  handlerRuns = 0;
});

interface ProbeCall {
  readonly key?: string;
  readonly body?: object;
  readonly path?: string;
  readonly userId?: string;
  readonly organizationId?: string;
}

/** Starts the request at once: a supertest request stays lazy until it is awaited. */
async function startProbe(call: ProbeCall) {
  return await callProbe(call);
}

function callProbe(call: ProbeCall = {}) {
  let pending = request(probe.app).post(`/api/v1${call.path ?? "/probe"}`);
  if (call.key !== undefined) pending = pending.set(IDEMPOTENCY_KEY_HEADER, call.key);
  if (call.userId !== undefined) pending = pending.set(USER_HEADER, call.userId);
  if (call.organizationId !== undefined) {
    pending = pending.set(ORGANIZATION_HEADER, call.organizationId);
  }
  return pending.send(call.body ?? { mode: "ok" });
}

describe("Idempotency-Key middleware", () => {
  it("replays the stored answer for the same key and body, and runs the handler once", async () => {
    const key = newId();

    const first = await callProbe({ key });
    const second = await callProbe({ key });

    expect(first.status).toBe(201);
    expect(first.headers[REPLAYED]).toBeUndefined();
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect(second.headers[REPLAYED]).toBe("true");
    expect(handlerRuns).toBe(1);
  });

  it("answers 422 IDEMPOTENCY_MISMATCH for the same key with another body", async () => {
    const key = newId();
    await callProbe({ key, body: { mode: "ok", amount: 1 } });

    const response = await callProbe({ key, body: { mode: "ok", amount: 2 } });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("IDEMPOTENCY_MISMATCH");
    expect(handlerRuns).toBe(1);
  });

  it("answers 400 naming the header when the key is missing or not a UUID", async () => {
    const missing = await callProbe();
    const malformed = await callProbe({ key: "not-a-uuid" });

    expect(missing.status).toBe(400);
    expect(missing.body.error.details.fields).toEqual([
      { path: "Idempotency-Key", messageKey: "validation.idempotency_key_required" },
    ]);
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.details.fields).toEqual([
      { path: "Idempotency-Key", messageKey: "validation.idempotency_key_invalid" },
    ]);
    expect(handlerRuns).toBe(0);
  });

  it("treats a body with the same fields in another order as the same request", async () => {
    const key = newId();
    await callProbe({ key, body: { mode: "ok", first: 1, second: { a: 1, b: 2 } } });

    const response = await callProbe({
      key,
      body: { second: { b: 2, a: 1 }, first: 1, mode: "ok" },
    });

    expect(response.headers[REPLAYED]).toBe("true");
    expect(handlerRuns).toBe(1);
  });

  it("treats the same key on another route as a different request", async () => {
    const key = newId();
    await callProbe({ key });

    const response = await callProbe({ key, path: "/probe-two" });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("IDEMPOTENCY_MISMATCH");
  });

  it("never runs the handler twice for two concurrent requests with the same key", async () => {
    for (let round = 0; round < 5; round += 1) {
      handlerRuns = 0;
      const key = newId();

      const responses = await Promise.all([
        callProbe({ key, body: { mode: "slow" } }),
        callProbe({ key, body: { mode: "slow" } }),
      ]);

      expect(handlerRuns).toBe(1);
      const statuses = responses.map((response) => response.status).sort();
      expect(statuses[0]).toBe(201);
      expect([201, 409]).toContain(statuses[1]);
      const rejected = responses.find((response) => response.status === 409);
      if (rejected === undefined) continue;
      expect(rejected.body.error.messageKey).toBe("errors.idempotency_in_progress");
      expect(rejected.headers["retry-after"]).toBe("1");
    }
  });

  it.each([
    ["a 4xx answer", "rejected"],
    ["an unexpected error", "crash"],
  ])("frees the key after %s, so the retry runs again", async (_label, mode) => {
    const key = newId();
    const failed = await callProbe({ key, body: { mode } });
    expect(failed.status).toBeGreaterThanOrEqual(400);

    const retry = await callProbe({ key, body: { mode } });

    expect(retry.headers[REPLAYED]).toBeUndefined();
    expect(handlerRuns).toBe(2);
  });

  it("refuses a handler that answers without response.json and frees the key", async () => {
    const key = newId();

    const response = await callProbe({ key, body: { mode: "raw-send" } });

    expect(response.status).toBe(500);
    expect(response.body.error.messageKey).toBe("errors.internal");
    const retry = await callProbe({ key, body: { mode: "raw-send" } });
    expect(retry.status).toBe(500);
    expect(handlerRuns).toBe(2);
  });

  it("takes over a request whose lock has expired", async () => {
    const key = newId();
    const stuck = startProbe({ key, body: { mode: "hold" } });
    await sleep(SLOW_MILLISECONDS);
    const whileLocked = await callProbe({ key, body: { mode: "hold" } });
    expect(whileLocked.status).toBe(409);

    clock.advanceSeconds(LOCK_SECONDS_PLUS_ONE);
    const takeover = startProbe({ key, body: { mode: "hold" } });
    await sleep(SLOW_MILLISECONDS);
    for (const release of heldRequests.splice(0)) release();
    const taken = await takeover;
    await stuck;

    expect(taken.status).toBe(201);
    expect(handlerRuns).toBe(2);
  });

  it("keeps keys apart per user and per organization", async () => {
    const key = newId();

    const responses = [
      await callProbe({ key, userId: newId() }),
      await callProbe({ key, userId: newId() }),
      await callProbe({ key, organizationId: newId() }),
      await callProbe({ key, organizationId: newId() }),
    ];

    for (const response of responses) expect(response.headers[REPLAYED]).toBeUndefined();
    expect(handlerRuns).toBe(4);
  });
});
