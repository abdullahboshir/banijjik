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
import { notFound, sendData, validate } from "../http/index.js";
import {
  createIdempotencyMiddleware,
  createStorefrontIdempotencyMiddleware,
  STOREFRONT_IDEMPOTENCY_CALLBACKS_REQUIRED,
} from "./idempotency.middleware.js";
import { registerIdempotencyModel } from "./idempotency-record.schema.js";
import { redactFromReplay } from "./replay-redaction.js";
import { storefrontNamespaceFromContext } from "./storefront-namespace.js";

registerIdempotencyModel();

const probeBodySchema = z.looseObject({ mode: z.string().default("ok") });
const USER_HEADER = "x-test-user";
const ORGANIZATION_HEADER = "x-test-organization";
const CUSTOMER_HEADER = "x-test-customer-account";
const GUEST_HEADER = "x-test-guest-session";
const REPLAYED = IDEMPOTENCY_REPLAYED_HEADER.toLowerCase();
const DEFAULT_USER_ID = newId();
const SLOW_MILLISECONDS = 200;
const LOCK_SECONDS_PLUS_ONE = 61;
const SECRET_ONCE = "once-only";

let connections: DatabaseConnections;
let clock: MutableClock;
let probe: TestApp;
let storefrontProbe: TestApp;
let handlerRuns = 0;
let denyStorefrontReplay = false;
const heldRequests: (() => void)[] = [];
let notifyHeldRequestStarted: (() => void) | undefined;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function holdUntilReleased(): Promise<void> {
  return new Promise((resolve) => {
    heldRequests.push(resolve);
    notifyHeldRequestStarted?.();
    notifyHeldRequestStarted = undefined;
  });
}

function nextHeldRequestStarted(): Promise<void> {
  return new Promise((resolve) => {
    notifyHeldRequestStarted = resolve;
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
  if (mode === "secret") {
    redactFromReplay(response, ["secret"]);
    sendData(response, { run: handlerRuns, secret: SECRET_ONCE }, { status: 201 });
    return true;
  }
  return false;
}

function buildStorefrontProbeRouter(router: Router): void {
  router.use((incoming, _response, next) => {
    const organizationId = incoming.get(ORGANIZATION_HEADER);
    const customerAccountId = incoming.get(CUSTOMER_HEADER);
    const guestSessionId = incoming.get(GUEST_HEADER);
    runWithRequestContext(
      {
        requestId: newId(),
        ...(organizationId === undefined ? {} : { organizationId }),
        ...(customerAccountId === undefined ? {} : { customerAccountId }),
        ...(guestSessionId === undefined ? {} : { guestSessionId }),
      },
      () => next(),
    );
  });
  const idempotency = createStorefrontIdempotencyMiddleware({
    clock,
    resolveNamespace: storefrontNamespaceFromContext,
    authorizeReplay: async () => {
      if (denyStorefrontReplay) throw notFound();
    },
  });
  router.post(
    "/storefront-probe",
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
  storefrontProbe = createTestApp(buildStorefrontProbeRouter);
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

beforeEach(() => {
  handlerRuns = 0;
  denyStorefrontReplay = false;
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

interface StorefrontProbeCall {
  readonly key: string;
  readonly organizationId: string;
  readonly customerAccountId?: string;
  readonly guestSessionId?: string;
  readonly body?: object;
}

function callStorefrontProbe(call: StorefrontProbeCall) {
  let pending = request(storefrontProbe.app)
    .post("/api/v1/storefront-probe")
    .set(IDEMPOTENCY_KEY_HEADER, call.key)
    .set(ORGANIZATION_HEADER, call.organizationId);
  if (call.customerAccountId !== undefined) {
    pending = pending.set(CUSTOMER_HEADER, call.customerAccountId);
  }
  if (call.guestSessionId !== undefined) pending = pending.set(GUEST_HEADER, call.guestSessionId);
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
    const firstStarted = nextHeldRequestStarted();
    const stuck = startProbe({ key, body: { mode: "hold" } });
    await firstStarted;
    const whileLocked = await callProbe({ key, body: { mode: "hold" } });
    expect(whileLocked.status).toBe(409);

    clock.advanceSeconds(LOCK_SECONDS_PLUS_ONE);
    const takeoverStarted = nextHeldRequestStarted();
    const takeover = startProbe({ key, body: { mode: "hold" } });
    await takeoverStarted;
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

  it("omits redacted fields from a replay so a stored answer carries no secret", async () => {
    const key = newId();

    const first = await callProbe({ key, body: { mode: "secret" } });
    const second = await callProbe({ key, body: { mode: "secret" } });

    expect(first.body.data.secret).toBe(SECRET_ONCE);
    expect(second.headers[REPLAYED]).toBe("true");
    expect(second.body.data.secret).toBeUndefined();
    expect(handlerRuns).toBe(1);
  });

  it("refuses to start when only one storefront callback is provided", () => {
    expect(() =>
      createIdempotencyMiddleware({
        clock,
        resolveNamespace: storefrontNamespaceFromContext,
      }),
    ).toThrow(STOREFRONT_IDEMPOTENCY_CALLBACKS_REQUIRED);
  });
});

describe("storefront Idempotency-Key namespace", () => {
  it("does not let another customer in the same organization replay a checkout key", async () => {
    const key = newId();
    const organizationId = newId();

    const first = await callStorefrontProbe({
      key,
      organizationId,
      customerAccountId: newId(),
    });
    const other = await callStorefrontProbe({
      key,
      organizationId,
      customerAccountId: newId(),
    });

    expect(first.status).toBe(201);
    expect(other.status).toBe(201);
    expect(other.headers[REPLAYED]).toBeUndefined();
    expect(handlerRuns).toBe(2);
  });

  it("does not let a guest session of another organization reuse the same key", async () => {
    const key = newId();
    const guestSessionId = newId();

    const first = await callStorefrontProbe({
      key,
      organizationId: newId(),
      guestSessionId,
    });
    const otherOrg = await callStorefrontProbe({
      key,
      organizationId: newId(),
      guestSessionId,
    });

    expect(first.status).toBe(201);
    expect(otherOrg.status).toBe(201);
    expect(otherOrg.headers[REPLAYED]).toBeUndefined();
    expect(handlerRuns).toBe(2);
  });

  it("ignores a guestSessionId in the body when choosing the namespace", async () => {
    const key = newId();
    const organizationId = newId();
    const cookieGuest = newId();
    const bodyGuest = newId();
    const body = { mode: "ok", guestSessionId: bodyGuest };

    const first = await callStorefrontProbe({
      key,
      organizationId,
      guestSessionId: cookieGuest,
      body,
    });
    const sameCookie = await callStorefrontProbe({
      key,
      organizationId,
      guestSessionId: cookieGuest,
      body,
    });
    const bodyGuestCaller = await callStorefrontProbe({
      key,
      organizationId,
      guestSessionId: bodyGuest,
      body,
    });

    expect(first.status).toBe(201);
    expect(sameCookie.headers[REPLAYED]).toBe("true");
    expect(bodyGuestCaller.headers[REPLAYED]).toBeUndefined();
    expect(handlerRuns).toBe(2);
  });

  it("hides a stored replay when current access is revoked", async () => {
    const key = newId();
    const organizationId = newId();
    const guestSessionId = newId();

    const first = await callStorefrontProbe({ key, organizationId, guestSessionId });
    denyStorefrontReplay = true;
    const replayed = await callStorefrontProbe({ key, organizationId, guestSessionId });

    expect(first.status).toBe(201);
    expect(replayed.status).toBe(404);
    expect(replayed.headers[REPLAYED]).toBeUndefined();
    expect(replayed.body.data).toBeUndefined();
    expect(handlerRuns).toBe(1);
  });

  it("replays for the same storefront principal after a lost response", async () => {
    const key = newId();
    const organizationId = newId();
    const customerAccountId = newId();

    const first = await callStorefrontProbe({ key, organizationId, customerAccountId });
    const retry = await callStorefrontProbe({ key, organizationId, customerAccountId });

    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.body).toEqual(first.body);
    expect(retry.headers[REPLAYED]).toBe("true");
    expect(handlerRuns).toBe(1);
  });
});
