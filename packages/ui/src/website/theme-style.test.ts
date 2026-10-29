import { describe, expect, it } from "vitest";
import type { SiteTokens } from "@banijjik/contracts/website";
import { brandingThemeStyle, siteThemeStyle } from "./theme-style.js";

function sampleTokens(): SiteTokens {
  return {
    color: {
      primary: "#15803d",
      accent: "#16a34a",
      background: "#ffffff",
      surface: "#f8fafc",
      text: "#0f172a",
      mutedText: "#334155",
      onPrimary: "#ffffff",
      focus: "#1d4ed8",
    },
    type: { fontPairKey: "inter-noto", scale: "MEDIUM" },
    shape: {
      cardRadius: "MEDIUM",
      buttonRadius: "MEDIUM",
      inputRadius: "SMALL",
      imageRadius: "SMALL",
      border: "THIN",
      shadow: "LOW",
    },
    spacing: { density: "COMFORTABLE" },
    size: {
      imageRatio: "LANDSCAPE",
      cardSize: "MEDIUM",
      columns: { mobile: 1, tablet: 2, desktop: 3 },
    },
  };
}

describe("brandingThemeStyle", () => {
  it("writes the business colours into the brand tokens and ignores a colour that is not a hex code", () => {
    expect(brandingThemeStyle({ primary: "#1F6F5C", accent: "teal" })).toEqual({
      "--color-brand-primary": "#1F6F5C",
      "--site-color-primary": "#1F6F5C",
    });
  });

  it("keeps the platform colours when the business has none", () => {
    expect(brandingThemeStyle(undefined)).toEqual({});
  });
});

describe("siteThemeStyle", () => {
  it("maps tokens to fixed CSS variables and never concatenates untrusted CSS", () => {
    const style = siteThemeStyle(sampleTokens());
    expect(style["--site-color-primary"]).toBe("#15803d");
    expect(style["--color-brand-primary"]).toBe("#15803d");
    expect(style["--site-radius-card"]).toBe("0.75rem");
    expect(style["--site-shadow"]).toContain("rgb");
    expect(style["--site-columns-desktop"]).toBe("3");
    expect(JSON.stringify(style)).not.toMatch(/url\(|expression|javascript/i);
  });

  it("drops a colour that is not a six-digit hex code so CSS injection cannot land", () => {
    const tokens = sampleTokens();
    const poisoned = {
      ...tokens,
      color: {
        ...tokens.color,
        primary: "red; background: url(javascript:alert(1))",
        accent: "};}body{background:red",
      },
    };
    const style = siteThemeStyle(poisoned);
    expect(style["--site-color-primary"]).toBeUndefined();
    expect(style["--site-color-accent"]).toBeUndefined();
    expect(style["--site-color-background"]).toBe("#ffffff");
  });
});
