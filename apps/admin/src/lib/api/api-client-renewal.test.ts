import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { redirectToSignIn } = vi.hoisted(() => ({ redirectToSignIn: vi.fn() }));
vi.mock("./session-redirect", () => ({ redirectToSignIn }));

const { apiFetch } = await import("./api-client");

const UNAUTHENTICATED_BODY = {
  error: { code: "UNAUTHENTICATED", messageKey: "errors.unauthenticated", requestId: "r" },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface FakeApi {
  fetchMock: ReturnType<typeof vi.fn>;
  callsTo: (pathPart: string) => number;
}

/** A fake API where data calls answer 401 until a refresh has succeeded (or never, when refreshWorks is false). */
function stubApi(options: { refreshWorks: boolean; staysUnauthenticated?: boolean }): FakeApi {
  let isRenewed = false;
  const fetchMock = vi.fn((url: string) => {
    if (url.endsWith("/auth/refresh")) {
      isRenewed = options.refreshWorks;
      return Promise.resolve(
        options.refreshWorks
          ? new Response(null, { status: 204 })
          : json(UNAUTHENTICATED_BODY, 401),
      );
    }
    if (url.endsWith("/auth/login")) return Promise.resolve(json(UNAUTHENTICATED_BODY, 401));
    const isAllowed = isRenewed && !options.staysUnauthenticated;
    return Promise.resolve(
      isAllowed ? json({ data: { ok: true } }) : json(UNAUTHENTICATED_BODY, 401),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  const callsTo = (pathPart: string): number =>
    fetchMock.mock.calls.filter(([url]) => String(url).includes(pathPart)).length;
  return { fetchMock, callsTo };
}

beforeEach(() => {
  redirectToSignIn.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch session renewal", () => {
  it("renews the session once for three parallel 401s and retries all three", async () => {
    const api = stubApi({ refreshWorks: true });
    const results = await Promise.all([
      apiFetch("/things/1"),
      apiFetch("/things/2"),
      apiFetch("/things/3"),
    ]);
    expect(results.map((result) => result.data)).toEqual([
      { ok: true },
      { ok: true },
      { ok: true },
    ]);
    expect(api.callsTo("/auth/refresh")).toBe(1);
    expect(api.callsTo("/things/")).toBe(6);
    expect(redirectToSignIn).not.toHaveBeenCalled();
  });

  it("redirects to sign-in and rethrows the first error when the renewal fails", async () => {
    const api = stubApi({ refreshWorks: false });
    await expect(apiFetch("/things/1")).rejects.toMatchObject({ status: 401 });
    expect(api.callsTo("/things/")).toBe(1);
    expect(redirectToSignIn).toHaveBeenCalledTimes(1);
  });

  it("redirects to sign-in when the retried request is still refused", async () => {
    const api = stubApi({ refreshWorks: true, staysUnauthenticated: true });
    await expect(apiFetch("/things/1")).rejects.toMatchObject({ status: 401 });
    expect(api.callsTo("/auth/refresh")).toBe(1);
    expect(api.callsTo("/things/")).toBe(2);
    expect(redirectToSignIn).toHaveBeenCalledTimes(1);
  });

  it("does not renew or retry auth endpoints such as login", async () => {
    const api = stubApi({ refreshWorks: true });
    await expect(apiFetch("/auth/login", { method: "POST", body: {} })).rejects.toMatchObject({
      status: 401,
    });
    expect(api.fetchMock).toHaveBeenCalledTimes(1);
    expect(redirectToSignIn).not.toHaveBeenCalled();
  });

  it("does not renew again while the renewed session is still valid", async () => {
    const api = stubApi({ refreshWorks: true });
    await apiFetch("/things/1");
    await apiFetch("/things/2");
    expect(api.callsTo("/auth/refresh")).toBe(1);
  });
});
