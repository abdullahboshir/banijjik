import request from "supertest";
import { describe, expect, it } from "vitest";
import { VALIDATION_MESSAGE_KEYS } from "@banijjik/contracts";
import { z } from "zod";
import { createTestApp, type TestApp } from "../../test-support/test-app.js";
import { validate } from "./validate.js";

const orderBody = z.object({
  items: z.array(z.object({ quantity: z.number().int().min(1) })),
});

function createApp(): TestApp {
  return createTestApp((router) => {
    router.post("/orders", validate({ body: orderBody }), (_request, response) => {
      response.json({ data: response.locals["validated"] });
    });
    router.get(
      "/things/:thingId",
      validate({
        params: z.object({ thingId: z.coerce.number().int() }),
        query: z.object({ limit: z.coerce.number().int().default(20) }),
      }),
      (request, response) => {
        response.json({ data: response.locals["validated"], paramsOnRequest: request.params });
      },
    );
  });
}

describe("validate", () => {
  it("rejects a bad body with field paths and message keys, never Zod text", async () => {
    const { app } = createApp();

    const response = await request(app)
      .post("/api/v1/orders")
      .send({ items: [{ quantity: 2 }, { quantity: 0 }] });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.fields).toEqual([
      { path: "items.1.quantity", messageKey: "validation.too_small" },
    ]);
    expect(response.text).not.toMatch(/Too small|expected|Invalid input/i);
  });

  it("reports a missing body field with the Zod issue code as message key", async () => {
    const { app } = createApp();

    const response = await request(app).post("/api/v1/orders").send({});

    expect(response.body.error.details.fields).toEqual([
      { path: "items", messageKey: "validation.invalid_type" },
    ]);
  });

  it("hands the handler parsed params and query in response.locals.validated", async () => {
    const { app } = createApp();

    const response = await request(app).get("/api/v1/things/42?limit=5");

    expect(response.body.data).toEqual({ params: { thingId: 42 }, query: { limit: 5 } });
    expect(response.body.paramsOnRequest).toEqual({ thingId: 42 });
  });

  it("hands the handler the parsed body in response.locals.validated", async () => {
    const { app } = createApp();

    const response = await request(app)
      .post("/api/v1/orders")
      .send({ items: [{ quantity: 3 }], ignoredField: true });

    expect(response.status).toBe(200);
    expect(response.body.data.body).toEqual({ items: [{ quantity: 3 }] });
  });

  it("applies schema defaults to the query", async () => {
    const { app } = createApp();

    const response = await request(app).get("/api/v1/things/7");

    expect(response.body.data.query).toEqual({ limit: 20 });
  });

  it("collects failures from params and query in one error", async () => {
    const { app } = createApp();

    const response = await request(app).get("/api/v1/things/abc?limit=x");

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields).toHaveLength(2);
  });
});

describe("validate message keys", () => {
  const strictBody = z.strictObject({
    status: z.enum(["OPEN", "CLOSED"]),
    step: z.number().multipleOf(5),
    either: z.union([z.string(), z.number()]),
  });
  const recordBody = z.object({ labels: z.record(z.string().min(3), z.number()) });

  function createKeyApp(): TestApp {
    return createTestApp((router) => {
      router.post("/strict", validate({ body: strictBody }), (_request, response) => {
        response.json({ data: "ok" });
      });
      router.post("/record", validate({ body: recordBody }), (_request, response) => {
        response.json({ data: "ok" });
      });
    });
  }

  it("emits only keys that exist in the shared validation key list", async () => {
    const { app } = createKeyApp();

    const response = await request(app)
      .post("/api/v1/strict")
      .send({ status: "PENDING", step: 7, either: true, extra: 1 });

    const messageKeys = response.body.error.details.fields.map(
      (field: { messageKey: string }) => field.messageKey,
    );
    expect(messageKeys.sort()).toEqual([
      "validation.invalid_union",
      "validation.invalid_value",
      "validation.not_multiple_of",
      "validation.unrecognized_keys",
    ]);
    for (const messageKey of messageKeys) {
      expect(VALIDATION_MESSAGE_KEYS).toContain(messageKey);
    }
  });

  it("maps a Zod issue code outside the allow-list to validation.custom", async () => {
    const { app } = createKeyApp();

    const response = await request(app)
      .post("/api/v1/record")
      .send({ labels: { ab: 1 } });

    expect(response.body.error.details.fields).toEqual([
      { path: "labels.ab", messageKey: "validation.custom" },
    ]);
  });
});
