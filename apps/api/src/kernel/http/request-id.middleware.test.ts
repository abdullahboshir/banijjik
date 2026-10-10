import request from "supertest";
import { describe, expect, it } from "vitest";
import { isUuidV7 } from "@banijjik/ids";
import { createTestApp, type TestApp } from "../../test-support/test-app.js";

const INCOMING_ID = "3f8b1c52-9d4e-4a7b-8c21-5e6f7a8b9c0d";

function createApp(): TestApp {
  return createTestApp(() => undefined);
}

describe("request id middleware", () => {
  it("keeps an incoming X-Request-Id that is a UUID", async () => {
    const { app } = createApp();

    const response = await request(app).get("/health").set("X-Request-Id", INCOMING_ID);

    expect(response.headers["x-request-id"]).toBe(INCOMING_ID);
  });

  it("replaces a non-UUID X-Request-Id with a new UUID v7", async () => {
    const { app } = createApp();

    const response = await request(app).get("/health").set("X-Request-Id", "<script>");

    expect(response.headers["x-request-id"]).not.toContain("<script>");
    expect(isUuidV7(String(response.headers["x-request-id"]))).toBe(true);
  });

  it("replaces an over-long X-Request-Id", async () => {
    const { app } = createApp();

    const response = await request(app).get("/health").set("X-Request-Id", `${INCOMING_ID}-extra`);

    expect(isUuidV7(String(response.headers["x-request-id"]))).toBe(true);
  });

  it("generates a UUID v7 when the header is absent", async () => {
    const { app } = createApp();

    const response = await request(app).get("/health");

    expect(isUuidV7(String(response.headers["x-request-id"]))).toBe(true);
  });
});
