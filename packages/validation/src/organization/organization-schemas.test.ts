import { describe, expect, it } from "vitest";
import { organizationSlugSchema } from "../slug.js";
import { organizationCreateRequestSchema } from "./organization-create.schema.js";

const VALID_BODY = {
  name: "Rahim Store",
  slug: "rahim-store",
  industryTemplateKey: "RETAIL",
};

describe("organizationSlugSchema", () => {
  it.each([
    ["rahim-store", "rahim-store"],
    ["abc", "abc"],
    ["shop-24", "shop-24"],
    ["  Rahim-Store  ", "rahim-store"],
  ])("accepts %j as %j", (input, expected) => {
    expect(organizationSlugSchema.parse(input)).toBe(expected);
  });

  it.each([
    ["too short", "ab"],
    ["too long", "a".repeat(41)],
    ["double hyphen", "rahim--store"],
    ["leading hyphen", "-rahim"],
    ["trailing hyphen", "rahim-"],
    ["underscore", "rahim_store"],
    ["space inside", "rahim store"],
    ["Bangla text", "রহিম-স্টোর"],
    ["reserved word", "admin"],
    ["reserved word in capitals", "  API "],
    ["empty", ""],
  ])("rejects a slug that is %s", (_description, input) => {
    expect(organizationSlugSchema.safeParse(input).success).toBe(false);
  });
});

describe("organizationCreateRequestSchema", () => {
  it("accepts the minimal body and normalizes name and slug", () => {
    const parsed = organizationCreateRequestSchema.parse({
      ...VALID_BODY,
      name: "  Rahim Store ",
      slug: "Rahim-Store",
    });

    expect(parsed).toEqual(VALID_BODY);
  });

  it("keeps an optional district", () => {
    const parsed = organizationCreateRequestSchema.parse({ ...VALID_BODY, district: " Dhaka " });

    expect(parsed.district).toBe("Dhaka");
  });

  it("rejects an industry template key that is not one of the eight", () => {
    const result = organizationCreateRequestSchema.safeParse({
      ...VALID_BODY,
      industryTemplateKey: "BAKERY",
    });

    expect(result.error?.issues[0]?.path).toEqual(["industryTemplateKey"]);
  });

  it("rejects a name that is too short", () => {
    const result = organizationCreateRequestSchema.safeParse({ ...VALID_BODY, name: " a " });

    expect(result.error?.issues[0]?.path).toEqual(["name"]);
  });

  it("rejects a field it does not know, such as the currency or the owner", () => {
    const result = organizationCreateRequestSchema.safeParse({
      ...VALID_BODY,
      currencyCode: "BDT",
    });

    expect(result.error?.issues[0]?.code).toBe("unrecognized_keys");
  });

  it("reports a reserved slug at the slug path", () => {
    const result = organizationCreateRequestSchema.safeParse({ ...VALID_BODY, slug: "login" });

    expect(result.error?.issues[0]?.path).toEqual(["slug"]);
  });
});
