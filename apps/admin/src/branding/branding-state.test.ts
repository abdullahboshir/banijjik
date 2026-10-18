import { BRAND_COLOR_PRESETS } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import {
  brandingToFormState,
  buildBrandingUpdate,
  checkColour,
  matchingPresetKey,
  type BrandingFormState,
} from "./branding-state";

const EMPTY: BrandingFormState = {
  logoFileId: undefined,
  logoUrl: undefined,
  primaryColor: "",
  accentColor: "",
  tagline: "",
};

function withChanges(changes: Partial<BrandingFormState>): BrandingFormState {
  return { ...EMPTY, ...changes };
}

describe("brandingToFormState", () => {
  it("reads a stored branding, with the logo address under the API origin", () => {
    const state = brandingToFormState(
      {
        logoFileId: "file-1",
        logoUrl: "/api/v1/public/files/file-1/medium",
        primaryColor: "#15803d",
        tagline: "Fresh every day",
      },
      "http://localhost:4000",
    );

    expect(state).toEqual({
      logoFileId: "file-1",
      logoUrl: "http://localhost:4000/api/v1/public/files/file-1/medium",
      primaryColor: "#15803d",
      accentColor: "",
      tagline: "Fresh every day",
    });
  });

  it("reads an empty branding as empty boxes", () => {
    expect(brandingToFormState({}, "")).toEqual(EMPTY);
  });
});

describe("checkColour", () => {
  it("says nothing for an empty box and flags text that is not a colour code", () => {
    expect(checkColour("primary", "  ")).toEqual({ status: "unset" });
    expect(checkColour("primary", "#12345")).toEqual({ status: "invalid" });
    expect(checkColour("accent", "teal")).toEqual({ status: "invalid" });
  });

  it("reads a dark colour as fine for a primary and a white one as too pale, with the ratio", () => {
    expect(checkColour("primary", "#15803d")).toEqual({ status: "ok", ratio: "5.0" });
    expect(checkColour("primary", "#ffffff")).toEqual({ status: "low", ratio: "1.0" });
  });

  it("asks less of an accent: the same teal fails as a primary and passes as an accent", () => {
    expect(checkColour("primary", "#0d9488").status).toBe("low");
    expect(checkColour("accent", "#0d9488").status).toBe("ok");
  });
});

describe("matchingPresetKey", () => {
  it.each(BRAND_COLOR_PRESETS)("finds the $presetKey preset from its two colours", (preset) => {
    const state = withChanges({
      primaryColor: preset.primaryColor.toUpperCase(),
      accentColor: preset.accentColor,
    });

    expect(matchingPresetKey(state)).toBe(preset.presetKey);
  });

  it("finds none for a custom pair or a half-matching one", () => {
    const [first] = BRAND_COLOR_PRESETS;
    expect(
      matchingPresetKey(withChanges({ primaryColor: "#123456", accentColor: "#654321" })),
    ).toBe(undefined);
    expect(
      matchingPresetKey(withChanges({ primaryColor: first?.primaryColor ?? "", accentColor: "" })),
    ).toBe(undefined);
  });
});

describe("buildBrandingUpdate", () => {
  it("sends nothing when nothing changed", () => {
    expect(buildBrandingUpdate(EMPTY, EMPTY)).toEqual({ ok: true, branding: undefined });
  });

  it("sends only the keys that changed, lower-cased and trimmed", () => {
    const initial = withChanges({ primaryColor: "#15803d", tagline: "Old" });
    const current = withChanges({
      primaryColor: "#15803d",
      accentColor: " #16A34A ",
      tagline: "Old",
      logoFileId: "file-2",
    });

    expect(buildBrandingUpdate(current, initial)).toEqual({
      ok: true,
      branding: { accentColor: "#16a34a", logoFileId: "file-2" },
    });
  });

  it("clears with null the keys that were emptied", () => {
    const initial = withChanges({
      logoFileId: "file-1",
      primaryColor: "#15803d",
      accentColor: "#16a34a",
      tagline: "Hello",
    });

    expect(buildBrandingUpdate(EMPTY, initial)).toEqual({
      ok: true,
      branding: { logoFileId: null, primaryColor: null, accentColor: null, tagline: null },
    });
  });

  it("refuses, before anything is sent, a code that is not a colour and a colour that is too pale", () => {
    const result = buildBrandingUpdate(
      withChanges({ primaryColor: "#ffffff", accentColor: "#12" }),
      EMPTY,
    );

    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        primaryColor: "validation.color_low_contrast",
        accentColor: "branding.colours.invalid",
      },
    });
  });

  it("lets a bad colour be cleared: an empty box is never an error", () => {
    const initial = withChanges({ primaryColor: "#15803d" });

    expect(buildBrandingUpdate(EMPTY, initial)).toEqual({
      ok: true,
      branding: { primaryColor: null },
    });
  });
});
