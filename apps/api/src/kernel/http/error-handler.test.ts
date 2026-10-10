import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../../test-support/test-app.js";
import { ALLOWED_ORIGIN } from "../../test-support/test-config.js";
import { ERROR_CODE } from "@banijjik/contracts";
import { AppError, conflict, forbidden, notFound } from "./app-error.js";

const FAKE_SECRET = "hunter2-do-not-leak";

function createApp(): TestApp {
  return createTestApp((router) => {
    router.get("/missing", () => {
      throw notFound();
    });
    router.get("/forbidden", () => {
      throw forbidden();
    });
    router.get("/conflict", () => {
      throw conflict({ currentVersion: 4 });
    });
    router.get("/internal-app-error", () => {
      throw new AppError({
        code: ERROR_CODE.INTERNAL,
        messageKey: "errors.unknown_model",
        details: { modelName: "Order" },
      });
    });
    router.get("/retry-later", () => {
      throw new AppError({ code: ERROR_CODE.RETRY_LATER });
    });
    router.get("/crash", () => {
      throw new Error(`db password=${FAKE_SECRET}`);
    });
    router.get("/async-crash", async () => {
      await Promise.resolve();
      throw new Error(`db password=${FAKE_SECRET}`);
    });
    router.post("/echo", (_request, response) => {
      response.json({ data: "ok" });
    });
  });
}

describe("error handler", () => {
  it("answers an AppError with its status and the error envelope", async () => {
    const { app } = createApp();

    const response = await request(app).get("/api/v1/missing");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        messageKey: "errors.not_found",
        requestId: response.headers["x-request-id"],
      },
    });
  });

  it("uses the status of each error code and passes details through", async () => {
    const { app } = createApp();

    const forbiddenResponse = await request(app).get("/api/v1/forbidden");
    const conflictResponse = await request(app).get("/api/v1/conflict");

    expect(forbiddenResponse.status).toBe(403);
    expect(conflictResponse.status).toBe(409);
    expect(conflictResponse.body.error.details).toEqual({ currentVersion: 4 });
  });

  it.each(["/api/v1/crash", "/api/v1/async-crash"])(
    "turns an unknown error from %s into INTERNAL without leaking its message or stack",
    async (path) => {
      const { app, logs } = createApp();

      const response = await request(app).get(path);

      expect(response.status).toBe(500);
      expect(response.body.error).toEqual({
        code: "INTERNAL",
        messageKey: "errors.internal",
        requestId: response.headers["x-request-id"],
      });
      expect(response.text).not.toContain(FAKE_SECRET);
      expect(response.text).not.toContain("at ");
      const errorLines = logs.lines().filter((line) => line["msg"] === "unhandled error");
      expect(errorLines).toHaveLength(1);
      expect(errorLines[0]?.["requestId"]).toBe(response.headers["x-request-id"]);
      expect(JSON.stringify(errorLines[0])).toContain(FAKE_SECRET);
    },
  );

  it("reports an INTERNAL AppError with its stack and answers the generic body without details (J1)", async () => {
    const { app, logs } = createApp();

    const response = await request(app).get("/api/v1/internal-app-error");

    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({
      code: "INTERNAL",
      messageKey: "errors.internal",
      requestId: response.headers["x-request-id"],
    });
    expect(response.text).not.toContain("unknown_model");
    expect(response.text).not.toContain("Order");
    const errorLines = logs.lines().filter((line) => line["msg"] === "unhandled error");
    expect(errorLines).toHaveLength(1);
    expect(errorLines[0]?.["err"]).toMatchObject({
      code: "INTERNAL",
      messageKey: "errors.unknown_model",
      details: { modelName: "Order" },
      stack: expect.stringContaining("at "),
    });
  });

  it("answers RETRY_LATER as 503 with Retry-After and keeps its own message key", async () => {
    const { app, logs } = createApp();

    const response = await request(app).get("/api/v1/retry-later");

    expect(response.status).toBe(503);
    expect(response.headers["retry-after"]).toBe("1");
    expect(response.body.error.code).toBe("RETRY_LATER");
    expect(response.body.error.messageKey).toBe("errors.retry_later");
    expect(logs.lines().some((line) => line["msg"] === "unhandled error")).toBe(false);
  });

  it("rejects malformed JSON with VALIDATION_ERROR invalid_json", async () => {
    const { app } = createApp();

    const response = await request(app)
      .post("/api/v1/echo")
      .set("Content-Type", "application/json")
      .send("{ not json");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.fields).toEqual([
      { path: "", messageKey: "errors.invalid_json" },
    ]);
    expect(response.text).not.toContain("Unexpected");
  });

  it("rejects a body over 1 MB with VALIDATION_ERROR payload_too_large", async () => {
    const { app } = createApp();
    const oversizedBody = { text: "x".repeat(1024 * 1024 + 1) };

    const response = await request(app).post("/api/v1/echo").send(oversizedBody);

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields).toEqual([
      { path: "", messageKey: "errors.payload_too_large" },
    ]);
  });

  it("answers an unknown route with the NOT_FOUND envelope", async () => {
    const { app } = createApp();

    const response = await request(app).get("/api/v1/no-such-route");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(response.body.error.requestId).toBe(response.headers["x-request-id"]);
  });
});

describe("error handler body errors", () => {
  it("allows CORS headers on an invalid JSON response from an allowed origin", async () => {
    const { app } = createApp();

    const response = await request(app)
      .post("/api/v1/echo")
      .set("Origin", ALLOWED_ORIGIN)
      .set("Content-Type", "application/json")
      .send("{ not json");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
  });

  it("answers an unsupported content encoding with 400 invalid_body and does not report it", async () => {
    const { app, logs } = createApp();

    const response = await request(app)
      .post("/api/v1/echo")
      .set("Content-Type", "application/json")
      .set("Content-Encoding", "bogus")
      .send("{}");

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields).toEqual([
      { path: "", messageKey: "errors.invalid_body" },
    ]);
    expect(logs.lines().some((line) => line["msg"] === "unhandled error")).toBe(false);
  });
});
