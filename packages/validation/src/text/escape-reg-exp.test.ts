import { describe, expect, it } from "vitest";
import { escapeRegExp } from "./escape-reg-exp.js";

describe("escapeRegExp", () => {
  it("escapes every character that has a meaning in a pattern", () => {
    expect(escapeRegExp(".*+?^${}()|[]\\")).toBe("\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\");
  });

  it("makes a typed text match only itself", () => {
    const pattern = new RegExp(`^${escapeRegExp("a.b(c")}`);

    expect(pattern.test("a.b(cd")).toBe(true);
    expect(pattern.test("axb(cd")).toBe(false);
  });

  it("leaves plain text alone", () => {
    expect(escapeRegExp("Rahim Store 24")).toBe("Rahim Store 24");
  });
});
