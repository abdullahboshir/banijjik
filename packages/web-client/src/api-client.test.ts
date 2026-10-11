import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApiClient, type ApiClient } from "./api-client.js";
import { ApiError } from "./api-error.js";

const UNAUTHENTICATED_BODY = {
  error: { code: "UNAUTHENTICATED", messageKey: "errors.unauthenticated", requestId: "r" },
};

interface Audience {
  name: string;
  refreshPath: string;
  authPathPrefix: string;
  loginPath: string;
}

/** The two audiences of the platform: the same code must behave the same with either set of paths. */
const AUDIENCES: Audience[] = [
  {
    name: "admin",
    refreshPath: "/auth/refresh",
    authPathPrefix: "/auth/",
    loginPath: "/auth/login",
  },
  {
    name: "platform",
    refreshPath: "/platform/auth/refresh",
    authPathPrefix: "/platform/auth/",
    loginPath: "/platform/auth/login",
  },
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function lastRequest(fetchMock: ReturnType<typeof vi.fn>): [string, RequestInit] {
  return fetchMock.mock.calls[0] as unknown as [string, RequestInit];
}

function stubFetch(response: Response | Error): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each(AUDIENCES)("apiFetch of the $name audience", (audience) => {
  const onSessionLost = vi.fn();
  let client: ApiClient;

  beforeEach(() => {
    onSessionLost.mockClear();
    client = createApiClient({
      baseUrl: "https://api.example.com",
      apiPrefix: "/api/v1",
      refreshPath: audience.refreshPath,
      authPathPrefix: audience.authPathPrefix,
      onSessionLost,
    });
  });

  describe("requests", () => {
    it("sends cookies and builds the URL from the base URL, the prefix and the path", async () => {
      const fetchMock = stubFetch(json({ data: { ok: true } }));
      await client.apiFetch("/me/orgs");
      const [url, init] = lastRequest(fetchMock);
      expect(url).toBe("https://api.example.com/api/v1/me/orgs");
      expect(init.credentials).toBe("include");
      expect(init.method).toBe("GET");
    });

    it("sends the Idempotency-Key header and a JSON body when given", async () => {
      const fetchMock = stubFetch(json({ data: {} }, 201));
      await client.apiFetch("/things", {
        method: "POST",
        body: { name: "x" },
        idempotencyKey: "key-1",
      });
      const [, init] = lastRequest(fetchMock);
      const headers = init.headers as Record<string, string>;
      expect(headers["Idempotency-Key"]).toBe("key-1");
      expect(headers["Content-Type"]).toBe("application/json");
      expect(init.body).toBe(JSON.stringify({ name: "x" }));
    });
  });

  describe("answers", () => {
    it("returns data and meta from a success envelope", async () => {
      stubFetch(json({ data: [1, 2], meta: { page: 1, hasNext: false } }));
      const result = await client.apiFetch<number[]>("/things");
      expect(result).toEqual({ data: [1, 2], meta: { page: 1, hasNext: false } });
    });

    it("throws an ApiError with code, messageKey and requestId from an error envelope", async () => {
      stubFetch(
        json(
          { error: { code: "FORBIDDEN", messageKey: "errors.forbidden", requestId: "req-1" } },
          403,
        ),
      );
      const failure = await client.apiFetch("/things").catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(ApiError);
      expect(failure).toMatchObject({ status: 403, code: "FORBIDDEN", requestId: "req-1" });
    });

    it("maps a response without an error envelope to INTERNAL", async () => {
      stubFetch(new Response("<html>bad gateway</html>", { status: 502 }));
      await expect(client.apiFetch("/things")).rejects.toMatchObject({
        status: 502,
        code: "INTERNAL",
        messageKey: "errors.internal",
      });
    });

    it("throws errors.invalid_response for a 2xx without a data property", async () => {
      stubFetch(json({ ok: true }));
      await expect(client.apiFetch("/things")).rejects.toMatchObject({
        messageKey: "errors.invalid_response",
      });
    });

    it("resolves a 204 No Content to an undefined data", async () => {
      stubFetch(new Response(null, { status: 204 }));
      await expect(client.apiFetch<void>("/things/1", { method: "DELETE" })).resolves.toEqual({
        data: undefined,
      });
    });

    it("maps a network failure to errors.network", async () => {
      stubFetch(new TypeError("Failed to fetch"));
      await expect(client.apiFetch("/things")).rejects.toMatchObject({
        messageKey: "errors.network",
      });
    });

    it("lets an aborted request surface as an abort, not a network error", async () => {
      stubFetch(new DOMException("aborted", "AbortError"));
      await expect(client.apiFetch("/things")).rejects.toMatchObject({ name: "AbortError" });
    });
  });

  describe("session renewal", () => {
    /** A fake API where data calls answer 401 until the refresh path has succeeded (or never). */
    function stubApi(options: { refreshWorks: boolean; staysUnauthenticated?: boolean }): {
      callsTo: (pathPart: string) => number;
      fetchMock: ReturnType<typeof vi.fn>;
    } {
      let isRenewed = false;
      const fetchMock = vi.fn((url: string) => {
        if (url.endsWith(audience.refreshPath)) {
          isRenewed = options.refreshWorks;
          return Promise.resolve(
            options.refreshWorks
              ? new Response(null, { status: 204 })
              : json(UNAUTHENTICATED_BODY, 401),
          );
        }
        if (url.endsWith(audience.loginPath))
          return Promise.resolve(json(UNAUTHENTICATED_BODY, 401));
        const isAllowed = isRenewed && !options.staysUnauthenticated;
        return Promise.resolve(
          isAllowed ? json({ data: { ok: true } }) : json(UNAUTHENTICATED_BODY, 401),
        );
      });
      vi.stubGlobal("fetch", fetchMock);
      const callsTo = (pathPart: string): number =>
        fetchMock.mock.calls.filter(([url]) => String(url).includes(pathPart)).length;
      return { callsTo, fetchMock };
    }

    it("renews once through the audience's own refresh path for three parallel 401s", async () => {
      const api = stubApi({ refreshWorks: true });
      const results = await Promise.all([
        client.apiFetch("/things/1"),
        client.apiFetch("/things/2"),
        client.apiFetch("/things/3"),
      ]);
      expect(results.map((result) => result.data)).toEqual([
        { ok: true },
        { ok: true },
        { ok: true },
      ]);
      expect(api.callsTo(audience.refreshPath)).toBe(1);
      expect(api.callsTo("/things/")).toBe(6);
      expect(onSessionLost).not.toHaveBeenCalled();
    });

    it("reports a lost session and rethrows the first error when the renewal fails", async () => {
      const api = stubApi({ refreshWorks: false });
      await expect(client.apiFetch("/things/1")).rejects.toMatchObject({ status: 401 });
      expect(api.callsTo("/things/")).toBe(1);
      expect(onSessionLost).toHaveBeenCalledTimes(1);
    });

    it("reports a lost session when the retried request is still refused", async () => {
      const api = stubApi({ refreshWorks: true, staysUnauthenticated: true });
      await expect(client.apiFetch("/things/1")).rejects.toMatchObject({ status: 401 });
      expect(api.callsTo(audience.refreshPath)).toBe(1);
      expect(api.callsTo("/things/")).toBe(2);
      expect(onSessionLost).toHaveBeenCalledTimes(1);
    });

    it("does not renew or retry the audience's auth endpoints such as login", async () => {
      const api = stubApi({ refreshWorks: true });
      await expect(
        client.apiFetch(audience.loginPath, { method: "POST", body: {} }),
      ).rejects.toMatchObject({ status: 401 });
      expect(api.fetchMock).toHaveBeenCalledTimes(1);
      expect(onSessionLost).not.toHaveBeenCalled();
    });

    it("renews through its own refresh path when asked directly", async () => {
      const api = stubApi({ refreshWorks: true });
      await client.apiFetch("/things/1");
      expect(await client.refreshSession()).toBe(true);
      expect(api.callsTo(audience.refreshPath)).toBe(2);
    });
  });
});
