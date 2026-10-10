import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieValues = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => {
        const value = cookieValues.get(name);
        return value === undefined ? undefined : { name, value };
      },
      getAll: () => Array.from(cookieValues, ([name, value]) => ({ name, value })),
    }),
}));

const { serverApiFetch } = await import("./server-api-fetch");

function stubFetch(response: Response): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(() => Promise.resolve(response));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastRequest(fetchMock: ReturnType<typeof vi.fn>): [string, RequestInit] {
  return fetchMock.mock.calls[0] as unknown as [string, RequestInit];
}

beforeEach(() => {
  cookieValues.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("serverApiFetch", () => {
  it("forwards only the access cookie and asks for an uncached answer", async () => {
    cookieValues.set("access_token", "access-jwt");
    cookieValues.set("refresh_token", "refresh-secret");
    cookieValues.set("locale", "bn");
    const fetchMock = stubFetch(
      new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }),
    );

    const result = await serverApiFetch("/me");

    const [url, init] = lastRequest(fetchMock);
    expect(url).toBe("http://localhost:4000/api/v1/me");
    expect(init.cache).toBe("no-store");
    const headers = init.headers as Record<string, string>;
    expect(headers["Cookie"]).toBe("access_token=access-jwt");
    expect(JSON.stringify(init)).not.toContain("refresh-secret");
    expect(result).toEqual({ data: { ok: true } });
  });

  it("fails as unauthenticated without calling the API when there is no access cookie", async () => {
    cookieValues.set("refresh_token", "refresh-secret");
    const fetchMock = stubFetch(new Response("{}"));

    await expect(serverApiFetch("/me")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("turns an API refusal into an ApiError", async () => {
    cookieValues.set("access_token", "expired");
    stubFetch(
      new Response(
        JSON.stringify({
          error: { code: "UNAUTHENTICATED", messageKey: "errors.unauthenticated", requestId: "r" },
        }),
        { status: 401 },
      ),
    );

    await expect(serverApiFetch("/me/orgs")).rejects.toMatchObject({ status: 401 });
  });

  it("sends a JSON body for a PATCH", async () => {
    cookieValues.set("access_token", "access-jwt");
    const fetchMock = stubFetch(new Response(JSON.stringify({ data: {} }), { status: 200 }));

    await serverApiFetch("/me", { method: "PATCH", body: { version: 2 } });

    const [, init] = lastRequest(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ version: 2 }));
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });
});
