import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "./test-support/test-app.js";
import { ALLOWED_ORIGIN } from "./test-support/test-config.js";

function createApp(): TestApp {
  return createTestApp(() => undefined);
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
});
