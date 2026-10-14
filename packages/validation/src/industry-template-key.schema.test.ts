import { describe, expect, it } from "vitest";
import { industryTemplateKeySchema } from "./industry-template-key.schema.js";

describe("industryTemplateKeySchema", () => {
  it.each(["FCOMMERCE", "NEW_SHOP_2"])("accepts %s", (key) => {
    expect(industryTemplateKeySchema.parse(key)).toBe(key);
  });

  it.each([
    ["lowercase", "fcommerce"],
    ["one character", "A"],
    ["a hyphen", "bakery-shop"],
    ["41 characters", `A${"B".repeat(40)}`],
  ])("rejects %s", (_label, key) => {
    expect(industryTemplateKeySchema.safeParse(key).success).toBe(false);
  });
});
