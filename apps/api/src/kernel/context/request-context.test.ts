import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../../test-support/test-app.js";
import { AppError } from "../http/app-error.js";
import { getLogger } from "../logger/index.js";
import { findRequestContext, getRequestContext, runWithRequestContext } from "./index.js";

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

describe("request context", () => {
  it("throws INTERNAL from getRequestContext outside a request", () => {
    expect(() => getRequestContext()).toThrow(AppError);
    expect(() => getRequestContext()).toThrow(/INTERNAL/);
  });

  it("returns undefined from findRequestContext outside a request", () => {
    expect(findRequestContext()).toBeUndefined();
  });

  it("keeps the context across await boundaries", async () => {
    const result = await runWithRequestContext({ requestId: "one" }, async () => {
      await wait(5);
      await Promise.resolve();
      return getRequestContext().requestId;
    });

    expect(result).toBe("one");
  });

  it("isolates two concurrent requests, each logging its own request id", async () => {
    const { app, logs } = createTestApp((router) => {
      router.get("/slow/:label", async (httpRequest, response) => {
        await wait(httpRequest.params["label"] === "first" ? 40 : 5);
        getLogger().info({ label: httpRequest.params["label"] }, "handler log");
        response.json({ data: getRequestContext().requestId });
      });
    });

    const [first, second] = await Promise.all([
      request(app).get("/api/v1/slow/first"),
      request(app).get("/api/v1/slow/second"),
    ]);

    expect(first.body.data).toBe(first.headers["x-request-id"]);
    expect(second.body.data).toBe(second.headers["x-request-id"]);
    expect(first.body.data).not.toBe(second.body.data);
    const handlerLines = logs.lines().filter((line) => line["msg"] === "handler log");
    const firstLine = handlerLines.find((line) => line["label"] === "first");
    const secondLine = handlerLines.find((line) => line["label"] === "second");
    expect(firstLine?.["requestId"]).toBe(first.headers["x-request-id"]);
    expect(secondLine?.["requestId"]).toBe(second.headers["x-request-id"]);
  });

  it("keeps the context in handlers that run after the body was parsed", async () => {
    const { app } = createTestApp((router) => {
      router.post("/body", (_request, response) => {
        response.json({ data: findRequestContext()?.requestId ?? null });
      });
    });

    const response = await request(app)
      .post("/api/v1/body")
      .send({ big: "x".repeat(200_000) });

    expect(response.body.data).toBe(response.headers["x-request-id"]);
  });
});
