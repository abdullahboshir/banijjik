import { describe, expect, it } from "vitest";
import { buildSessionRenewalPath, buildSignInPath, safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it("keeps a same-origin path with its query", () => {
    expect(safeNextPath("/a/b")).toBe("/a/b");
    expect(safeNextPath("/acme/orders?status=open")).toBe("/acme/orders?status=open");
  });

  it.each([
    ["a protocol-relative URL", "//evil.com"],
    ["an absolute URL", "https://evil.com"],
    ["a javascript URL", "javascript:alert(1)"],
    ["a backslash host", "/\\evil.com"],
    ["a path with a tab", "/a\tb"],
    ["a relative path", "orders"],
    ["an empty string", ""],
  ])("falls back to the home path for %s", (_name, candidate) => {
    expect(safeNextPath(candidate)).toBe("/");
  });

  it("falls back to the home path when there is no value", () => {
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});

describe("sign-in and session paths", () => {
  it("encode the next path and refuse an unsafe one", () => {
    expect(buildSignInPath("/acme/orders?x=1")).toBe("/sign-in?next=%2Facme%2Forders%3Fx%3D1");
    expect(buildSessionRenewalPath("//evil.com")).toBe("/session?next=%2F");
  });
});
