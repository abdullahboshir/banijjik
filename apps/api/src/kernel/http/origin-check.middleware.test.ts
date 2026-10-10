import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../../test-support/test-app.js";
import { ALLOWED_ORIGIN } from "../../test-support/test-config.js";

function createApp() {
  return createTestApp((router) => {
    router.post("/things", (_request, response) => {
      response.json({ data: "created" });
    });
    router.get("/things", (_request, response) => {
      response.json({ data: "listed" });
    });
  }).app;
}

describe("origin check", () => {
  it("refuses an unsafe request from an origin outside the allow-list", async () => {
    const response = await request(createApp())
      .post("/api/v1/things")
      .set("Origin", "https://evil.example.com");

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      code: "FORBIDDEN",
      messageKey: "errors.origin_not_allowed",
    });
  });

  it("also checks PUT, PATCH and DELETE", async () => {
    const app = createApp();
    const refused = "https://evil.example.com";

    const statuses = [
      (await request(app).put("/api/v1/things").set("Origin", refused)).status,
      (await request(app).patch("/api/v1/things").set("Origin", refused)).status,
      (await request(app).delete("/api/v1/things").set("Origin", refused)).status,
    ];

    expect(statuses).toEqual([403, 403, 403]);
  });

  it("lets an unsafe request through from an allowed origin", async () => {
    const response = await request(createApp())
      .post("/api/v1/things")
      .set("Origin", ALLOWED_ORIGIN);

    expect(response.status).toBe(200);
  });

  it("lets an unsafe request through when there is no Origin header (curl, server to server)", async () => {
    const response = await request(createApp()).post("/api/v1/things");

    expect(response.status).toBe(200);
  });

  it("does not check safe methods", async () => {
    const response = await request(createApp())
      .get("/api/v1/things")
      .set("Origin", "https://evil.example.com");

    expect(response.status).toBe(200);
  });
});
