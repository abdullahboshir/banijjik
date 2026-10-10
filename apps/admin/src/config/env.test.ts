import { describe, expect, it } from "vitest";
import { env, parseEnvironment } from "./env";

const validSource = {
  NEXT_PUBLIC_API_BASE_URL: "https://api.example.com",
  NEXT_PUBLIC_BRAND_NAME: "Example",
};

describe("parseEnvironment", () => {
  it("accepts an absolute http(s) API URL and a brand name", () => {
    expect(parseEnvironment(validSource)).toEqual(validSource);
  });

  it("rejects a missing API base URL", () => {
    expect(() => parseEnvironment({ NEXT_PUBLIC_BRAND_NAME: "Example" })).toThrow(
      /NEXT_PUBLIC_API_BASE_URL/,
    );
  });

  it("rejects a relative API base URL", () => {
    expect(() => parseEnvironment({ ...validSource, NEXT_PUBLIC_API_BASE_URL: "/api" })).toThrow(
      /NEXT_PUBLIC_API_BASE_URL/,
    );
  });

  it("rejects a non-http protocol", () => {
    expect(() =>
      parseEnvironment({ ...validSource, NEXT_PUBLIC_API_BASE_URL: "ftp://api.example.com" }),
    ).toThrow(/NEXT_PUBLIC_API_BASE_URL/);
  });

  it("rejects an empty brand name", () => {
    expect(() => parseEnvironment({ ...validSource, NEXT_PUBLIC_BRAND_NAME: "  " })).toThrow(
      /NEXT_PUBLIC_BRAND_NAME/,
    );
  });
});

describe("env", () => {
  it("is validated from process.env when the module loads", () => {
    expect(env.NEXT_PUBLIC_API_BASE_URL).toBe("http://localhost:4000");
  });
});
