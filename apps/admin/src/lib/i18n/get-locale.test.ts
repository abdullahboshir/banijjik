import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieValues = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => {
        const value = cookieValues.get(name);
        return value === undefined ? undefined : { name, value };
      },
    }),
}));

const { getLocale } = await import("./get-locale");

beforeEach(() => {
  cookieValues.clear();
});

describe("getLocale", () => {
  it("returns bn when there is no locale cookie", async () => {
    expect(await getLocale()).toBe("bn");
  });

  it("returns en when the cookie says en", async () => {
    cookieValues.set("locale", "en");
    expect(await getLocale()).toBe("en");
  });

  it("returns bn for an unsupported cookie value", async () => {
    cookieValues.set("locale", "fr");
    expect(await getLocale()).toBe("bn");
  });
});
