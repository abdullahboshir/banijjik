import { describe, expect, it } from "vitest";
import { WEBSITE_TEMPLATE_KEY_PATTERN } from "./website-template.js";

describe("website template vocabulary", () => {
  it("a template key is lower kebab-case and rejects an uppercase or spaced value", () => {
    expect(WEBSITE_TEMPLATE_KEY_PATTERN.test("starter-chrome")).toBe(true);
    expect(WEBSITE_TEMPLATE_KEY_PATTERN.test("Starter-chrome")).toBe(false);
    expect(WEBSITE_TEMPLATE_KEY_PATTERN.test("starter chrome")).toBe(false);
  });
});
