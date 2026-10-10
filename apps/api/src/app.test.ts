import { ERROR_CODE } from "@banijjik/contracts";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { AppError } from "./kernel/http/index.js";
import { createTestApp, type TestApp } from "./test-support/test-app.js";
import { ALLOWED_ORIGIN } from "./test-support/test-config.js";

const COOKIE_SECRET = "SECRET-ACCESS-TOKEN-VALUE";

function createApp(): TestApp {
  return createTestApp((router) => {
    router.post("/login", (_request, response) => {
      response.cookie("access_token", COOKIE_SECRET, { httpOnly: true });
      response.json({ data: "ok" });
    });
    router.get("/limited", () => {
      throw new AppError({ code: ERROR_CODE.RATE_LIMITED, retryAfterSeconds: 30 });
    });
    router.get("/reset", (_request, response) => {
      response.json({ data: "ok" });
    });
  });
}

describe("GET /health", () => {
  it("answers 200 with the data envelope", async () => {
    const { app } = createApp();

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: "ok" } });
  });

  it("does not advertise the framework", async () => {
    const { app } = createApp();

    const response = await request(app).get("/health");

    expect(response.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("CORS", () => {
  it("allows a configured origin with credentials", async () => {
    const { app } = createApp();

    const response = await request(app).get("/health").set("Origin", ALLOWED_ORIGIN);

    expect(response.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("lets browser code read X-Request-Id (M3)", async () => {
    const { app } = createApp();

    const response = await request(app).get("/health").set("Origin", ALLOWED_ORIGIN);

    expect(response.headers["access-control-expose-headers"]).toBe(
      "X-Request-Id,Retry-After,Idempotency-Replayed",
    );
  });

  it("exposes Retry-After on a cross-origin 429 so the client can show the wait", async () => {
    const { app } = createApp();

    const response = await request(app).get("/api/v1/limited").set("Origin", ALLOWED_ORIGIN);

    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBe("30");
    expect(response.headers["access-control-expose-headers"]).toContain("Retry-After");
  });

  it("sends no allow header to an unknown origin", async () => {
    const { app } = createApp();

    const response = await request(app).get("/health").set("Origin", "https://evil.example.com");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("answers a preflight request for an allowed origin", async () => {
    const { app } = createApp();

    const response = await request(app)
      .options("/api/v1/anything")
      .set("Origin", ALLOWED_ORIGIN)
      .set("Access-Control-Request-Method", "POST");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
  });
});

describe("access log", () => {
  it("writes one line per response with the request id and without cookies", async () => {
    const { app, logs } = createApp();

    const response = await request(app)
      .get("/health")
      .set("Cookie", "session=very-secret-cookie")
      .set("Authorization", "Bearer very-secret-token");

    const accessLines = logs.lines().filter((line) => "responseTime" in line);
    expect(accessLines).toHaveLength(1);
    expect(accessLines[0]?.["requestId"]).toBe(response.headers["x-request-id"]);
    expect(logs.text()).not.toContain("very-secret");
  });

  it("never logs a Set-Cookie value from the response (B1)", async () => {
    const { app, logs } = createApp();

    const response = await request(app).post("/api/v1/login");

    expect(response.headers["set-cookie"]?.[0]).toContain(COOKIE_SECRET);
    expect(logs.text()).not.toContain(COOKIE_SECRET);
    const accessLine = logs.lines().find((line) => "responseTime" in line);
    expect(accessLine?.["res"]).toEqual({ statusCode: 200 });
  });

  it("logs the path without the query string (B1)", async () => {
    const { app, logs } = createApp();

    await request(app).get("/api/v1/reset?token=reset-token-123&email=rahim@example.com");

    expect(logs.text()).not.toContain("reset-token-123");
    expect(logs.text()).not.toContain("rahim@example.com");
    const accessLine = logs.lines().find((line) => "responseTime" in line);
    expect(accessLine?.["req"]).toMatchObject({ method: "GET", url: "/api/v1/reset" });
  });
});
