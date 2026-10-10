import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./api-client";
import { ApiError } from "./api-error";

function stubFetch(response: Response | Error): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function lastRequest(fetchMock: ReturnType<typeof vi.fn>): [string, RequestInit] {
  return fetchMock.mock.calls[0] as unknown as [string, RequestInit];
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("sends cookies and builds the URL from the base URL and /api/v1", async () => {
    const fetchMock = stubFetch(jsonResponse({ data: { ok: true } }));
    await apiFetch("/me/orgs");
    const [url, init] = lastRequest(fetchMock);
    expect(url).toBe("http://localhost:4000/api/v1/me/orgs");
    expect(init.credentials).toBe("include");
    expect(init.method).toBe("GET");
  });

  it("sends the Idempotency-Key header and a JSON body when given", async () => {
    const fetchMock = stubFetch(jsonResponse({ data: {} }, 201));
    await apiFetch("/things", { method: "POST", body: { name: "x" }, idempotencyKey: "key-1" });
    const [, init] = lastRequest(fetchMock);
    const headers = init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("key-1");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ name: "x" }));
  });

  it("returns data and meta from a success envelope", async () => {
    stubFetch(jsonResponse({ data: [1, 2], meta: { page: 1, hasNext: false } }));
    const result = await apiFetch<number[]>("/things");
    expect(result).toEqual({ data: [1, 2], meta: { page: 1, hasNext: false } });
  });

  it("throws an ApiError with code, messageKey and requestId from an error envelope", async () => {
    stubFetch(
      jsonResponse(
        { error: { code: "FORBIDDEN", messageKey: "errors.forbidden", requestId: "req-1" } },
        403,
      ),
    );
    const failure = await apiFetch("/things").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({
      status: 403,
      code: "FORBIDDEN",
      messageKey: "errors.forbidden",
      requestId: "req-1",
    });
  });

  it("maps a response without an error envelope to INTERNAL", async () => {
    stubFetch(new Response("<html>bad gateway</html>", { status: 502 }));
    await expect(apiFetch("/things")).rejects.toMatchObject({
      status: 502,
      code: "INTERNAL",
      messageKey: "errors.internal",
    });
  });

  it("maps a network failure to errors.network", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    await expect(apiFetch("/things")).rejects.toMatchObject({
      code: "INTERNAL",
      messageKey: "errors.network",
    });
  });

  it("lets an aborted request surface as an abort, not a network error", async () => {
    stubFetch(new DOMException("aborted", "AbortError"));
    await expect(apiFetch("/things")).rejects.toMatchObject({ name: "AbortError" });
  });
});
