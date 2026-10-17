import { BRAND_COLOR_PRESETS, BRANDING_RULES } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { brandingUpdateSchema } from "./branding.schema.js";
import { contrastRatio, isReadablePrimaryColor, isVisibleAccentColor } from "./color-contrast.js";
import { profileUpdateRequestSchema } from "./profile.schema.js";

describe("contrastRatio", () => {
  it("matches the known WCAG ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });

  it("does not depend on which colour is the foreground", () => {
    expect(contrastRatio("#0f766e", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#0f766e"),
      10,
    );
  });
});

describe("the colour presets", () => {
  it.each(BRAND_COLOR_PRESETS)(
    "$presetKey has a readable primary and a visible accent, both written as lower-case hex",
    (preset) => {
      expect(isReadablePrimaryColor(preset.primaryColor)).toBe(true);
      expect(isVisibleAccentColor(preset.accentColor)).toBe(true);
      expect(preset.primaryColor).toMatch(BRANDING_RULES.colorPattern);
      expect(preset.primaryColor).toBe(preset.primaryColor.toLowerCase());
      expect(preset.accentColor).toBe(preset.accentColor.toLowerCase());
    },
  );

  it("has eight pairs with distinct keys", () => {
    const keys = BRAND_COLOR_PRESETS.map((preset) => preset.presetKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(8);
  });
});

describe("the contrast rules", () => {
  it("refuses white as a primary colour and accepts a dark green", () => {
    expect(isReadablePrimaryColor("#ffffff")).toBe(false);
    expect(isReadablePrimaryColor("#15803d")).toBe(true);
  });

  it("refuses a light yellow accent and accepts a mid blue", () => {
    expect(isVisibleAccentColor("#fde68a")).toBe(false);
    expect(isVisibleAccentColor("#2563eb")).toBe(true);
  });

  it("asks less of an accent than of a primary colour", () => {
    // #0d9488 is about 3.7:1 on white: fine as a link or badge colour, too pale for white button text.
    expect(isVisibleAccentColor("#0d9488")).toBe(true);
    expect(isReadablePrimaryColor("#0d9488")).toBe(false);
  });
});

describe("brandingUpdateSchema", () => {
  it("lower-cases a colour and trims the tagline", () => {
    expect(
      brandingUpdateSchema.parse({ primaryColor: "#0F766E", tagline: "  Fresh every day  " }),
    ).toEqual({ primaryColor: "#0f766e", tagline: "Fresh every day" });
  });

  it("accepts null to clear each key", () => {
    const body = { logoFileId: null, primaryColor: null, accentColor: null, tagline: null };
    expect(brandingUpdateSchema.parse(body)).toEqual(body);
  });

  it.each(["0f766e", "#0f766", "#0f766e1", "#gggggg", "red", ""])(
    "refuses the colour %j that is not #RRGGBB",
    (color) => {
      expect(brandingUpdateSchema.safeParse({ primaryColor: color }).success).toBe(false);
    },
  );

  it("refuses a tagline of 81 characters, accepts one of 80, and refuses a blank one", () => {
    expect(brandingUpdateSchema.safeParse({ tagline: "a".repeat(81) }).success).toBe(false);
    expect(brandingUpdateSchema.safeParse({ tagline: "a".repeat(80) }).success).toBe(true);
    expect(brandingUpdateSchema.safeParse({ tagline: "   " }).success).toBe(false);
  });

  it("refuses an unknown key", () => {
    expect(brandingUpdateSchema.safeParse({ fontFamily: "Inter" }).success).toBe(false);
  });
});

describe("the profile update with branding", () => {
  it("counts branding as a change on its own", () => {
    expect(
      profileUpdateRequestSchema.safeParse({ version: 1, branding: { tagline: "Hello" } }).success,
    ).toBe(true);
    expect(profileUpdateRequestSchema.safeParse({ version: 1 }).success).toBe(false);
  });
});
