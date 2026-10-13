import { describe, expect, it } from "vitest";
import { isDuplicateKeyError } from "./duplicate-key.js";

const slugClash = { code: 11000, keyPattern: { slug: 1 } };

describe("isDuplicateKeyError", () => {
  it("recognizes the driver duplicate-key error", () => {
    expect(isDuplicateKeyError(slugClash)).toBe(true);
  });

  it("recognizes a duplicate on the named index field only", () => {
    expect(isDuplicateKeyError(slugClash, "slug")).toBe(true);
    expect(isDuplicateKeyError(slugClash, "email")).toBe(false);
  });

  it("finds the named field inside a compound index", () => {
    const compound = { code: 11000, keyPattern: { organizationId: 1, name: 1 } };

    expect(isDuplicateKeyError(compound, "name")).toBe(true);
  });

  it("does not match a named field when the error carries no key pattern", () => {
    expect(isDuplicateKeyError({ code: 11000 }, "slug")).toBe(false);
    expect(isDuplicateKeyError({ code: 11000, keyPattern: null }, "slug")).toBe(false);
  });

  it.each([
    ["another error code", { code: 121, keyPattern: { slug: 1 } }],
    ["an error without a code", new Error("boom")],
    ["null", null],
    ["a string", "11000"],
    ["undefined", undefined],
  ])("refuses %s", (_description, error) => {
    expect(isDuplicateKeyError(error)).toBe(false);
  });
});
