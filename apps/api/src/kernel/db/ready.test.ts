import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp } from "../../test-support/test-app.js";
import { connectTestDatabases } from "../../test-support/test-databases.js";
import type { DatabaseConnections } from "./database-connections.js";
import { isDatabaseReady } from "./ready.js";

let connections: DatabaseConnections;

beforeAll(async () => {
  connections = await connectTestDatabases();
});

afterAll(async () => {
  await connections.close();
});

describe("GET /ready", () => {
  it("answers 200 while the replica set is up", async () => {
    const { app } = createTestApp(() => undefined);

    const response = await request(app).get("/ready");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: "ready" } });
  });

  it("answers 503 with the not_ready error and a request id after the connections close", async () => {
    const { app } = createTestApp(() => undefined);
    await connections.close();

    const response = await request(app).get("/ready");

    expect(response.status).toBe(503);
    expect(response.body.error).toMatchObject({ code: "INTERNAL", messageKey: "errors.not_ready" });
    expect(response.body.error.requestId).toBe(response.headers["x-request-id"]);
  });
});

describe("isDatabaseReady", () => {
  it("is false when the probe does not answer within the timeout", async () => {
    const hungProbe = (): Promise<boolean> => new Promise<boolean>(() => undefined);

    expect(await isDatabaseReady(20, hungProbe)).toBe(false);
  });

  it("is false when the probe fails", async () => {
    const failingProbe = (): Promise<boolean> => Promise.reject(new Error("connection reset"));

    expect(await isDatabaseReady(1000, failingProbe)).toBe(false);
  });

  it("is true when the probe answers in time", async () => {
    expect(await isDatabaseReady(1000, async () => true)).toBe(true);
  });
});
