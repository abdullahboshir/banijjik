import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieValues = new Map<string, string>();

vi.mock("next/headers.js", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => {
        const value = cookieValues.get(name);
        return value === undefined ? undefined : { name, value };
      },
    }),
}));

const { createServerApiFetch } = await import("./server-api-fetch.js");

const AUDIENCES = [
  { name: "admin", accessCookieName: "access_token", refreshCookieName: "refresh_token" },
  {
    name: "platform",
    accessCookieName: "platform_access_token",
    refreshCookieName: "platform_refresh_token",
  },
] as const;

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

describe.each(AUDIENCES)("server API fetch of the $name audience", (audience) => {
  const { serverApiFetch, serverPublicApiFetch } = createServerApiFetch({
    baseUrl: "http://localhost:4000",
    apiPrefix: "/api/v1",
    accessCookieName: audience.accessCookieName,
  });

  it("forwards only its own access cookie and asks for an uncached answer", async () => {
    cookieValues.set(audience.accessCookieName, "access-jwt");
    cookieValues.set(audience.refreshCookieName, "refresh-secret");
    cookieValues.set("locale", "bn");
    const fetchMock = stubFetch(
      new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }),
    );

    const result = await serverApiFetch("/me");

    const [url, init] = lastRequest(fetchMock);
    expect(url).toBe("http://localhost:4000/api/v1/me");
    expect(init.cache).toBe("no-store");
    expect((init.headers as Record<string, string>)["Cookie"]).toBe(
      `${audience.accessCookieName}=access-jwt`,
    );
    expect(JSON.stringify(init)).not.toContain("refresh-secret");
    expect(result).toEqual({ data: { ok: true } });
  });

  it("fails as unauthenticated without calling the API when its access cookie is missing", async () => {
    cookieValues.set(audience.refreshCookieName, "refresh-secret");
    const otherCookie =
      audience.accessCookieName === "access_token" ? "platform_access_token" : "access_token";
    cookieValues.set(otherCookie, "other-audience-jwt");
    const fetchMock = stubFetch(new Response("{}"));

    await expect(serverApiFetch("/me")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("turns an API refusal into an ApiError", async () => {
    cookieValues.set(audience.accessCookieName, "expired");
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
    cookieValues.set(audience.accessCookieName, "access-jwt");
    const fetchMock = stubFetch(new Response(JSON.stringify({ data: {} }), { status: 200 }));

    await serverApiFetch("/me", { method: "PATCH", body: { version: 2 } });

    const [, init] = lastRequest(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ version: 2 }));
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("sends no cookie at all on a public call, even when the visitor has one", async () => {
    cookieValues.set(audience.accessCookieName, "access-jwt");
    const fetchMock = stubFetch(new Response(JSON.stringify({ data: { ok: 1 } }), { status: 200 }));

    const result = await serverPublicApiFetch("/invitations/some-token");

    const [url, init] = lastRequest(fetchMock);
    expect(url).toBe("http://localhost:4000/api/v1/invitations/some-token");
    expect(init.headers).toEqual({ Accept: "application/json" });
    expect(result.data).toEqual({ ok: 1 });
  });
});
