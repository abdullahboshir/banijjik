import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieWrites: { name: string; value: string; options: unknown }[] = [];
const apiCalls: { path: string; method: string; body: unknown }[] = [];
let apiShouldFail = false;

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      set: (name: string, value: string, options: unknown) =>
        cookieWrites.push({ name, value, options }),
    }),
}));

vi.mock("../api/server-api-fetch", () => ({
  serverApiFetch: (path: string, options: { method?: string; body?: unknown } = {}) => {
    apiCalls.push({ path, method: options.method ?? "GET", body: options.body });
    if (apiShouldFail) return Promise.reject(new Error("no session"));
    return Promise.resolve({ data: { version: 4 } });
  },
}));

const { setLocaleAction } = await import("./set-locale.action");

beforeEach(() => {
  cookieWrites.length = 0;
  apiCalls.length = 0;
  apiShouldFail = false;
});

describe("setLocaleAction", () => {
  it("sets the locale cookie for a year and patches the profile with the current version", async () => {
    const result = await setLocaleAction("en");
    expect(result).toEqual({ isLocaleSet: true, isProfileUpdated: true });
    expect(cookieWrites).toEqual([
      {
        name: "locale",
        value: "en",
        options: { maxAge: 31_536_000, sameSite: "lax", path: "/" },
      },
    ]);
    expect(apiCalls.at(-1)).toEqual({
      path: "/me",
      method: "PATCH",
      body: { preferredLocale: "en", version: 4 },
    });
  });

  it("keeps the cookie when the profile cannot be updated, for example when signed out", async () => {
    apiShouldFail = true;
    const result = await setLocaleAction("bn");
    expect(result).toEqual({ isLocaleSet: true, isProfileUpdated: false });
    expect(cookieWrites).toHaveLength(1);
  });

  it("ignores a language that is not supported", async () => {
    const result = await setLocaleAction("fr");
    expect(result.isLocaleSet).toBe(false);
    expect(cookieWrites).toHaveLength(0);
    expect(apiCalls).toHaveLength(0);
  });
});
