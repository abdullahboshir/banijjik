import { describe, expect, it } from "vitest";
import { colorTokens, type ColorTheme } from "./color.js";

const AA_BODY_TEXT = 4.5;
const THEMES: ColorTheme[] = ["light", "dark"];

function channelLuminance(channel: number): number {
  const scaled = channel / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const [red = 0, green = 0, blue = 0] = [1, 3, 5].map((start) =>
    Number.parseInt(hex.slice(start, start + 2), 16),
  );
  return (
    0.2126 * channelLuminance(red) +
    0.7152 * channelLuminance(green) +
    0.0722 * channelLuminance(blue)
  );
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter = 0, darker = 0] = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ].sort((first, second) => second - first);
  return (lighter + 0.05) / (darker + 0.05);
}

const backgrounds = Object.entries(colorTokens.bg);
const textColors = [
  ["text.primary", colorTokens.text.primary],
  ["text.secondary", colorTokens.text.secondary],
] as const;
const statusColors = Object.entries(colorTokens.status);
const textOnBackgroundPairs = textColors.flatMap(([textName, text]) =>
  backgrounds.map(([backgroundName, background]) => ({
    name: `${textName} on bg.${backgroundName}`,
    text,
    background,
  })),
);

describe.each(THEMES)("%s theme contrast (WCAG AA 4.5:1)", (theme) => {
  it.each(textOnBackgroundPairs)("$name is readable", ({ text, background }) => {
    expect(contrastRatio(text[theme], background[theme])).toBeGreaterThanOrEqual(AA_BODY_TEXT);
  });

  it("text on the primary button is readable in rest and hover states", () => {
    const onPrimary = colorTokens.brand.onPrimary[theme];
    expect(contrastRatio(onPrimary, colorTokens.brand.primary[theme])).toBeGreaterThanOrEqual(
      AA_BODY_TEXT,
    );
    expect(contrastRatio(onPrimary, colorTokens.brand.primaryHover[theme])).toBeGreaterThanOrEqual(
      AA_BODY_TEXT,
    );
  });

  it("brand colour is readable as link text on app and surface backgrounds", () => {
    const brand = colorTokens.brand.primary[theme];
    expect(contrastRatio(brand, colorTokens.bg.app[theme])).toBeGreaterThanOrEqual(AA_BODY_TEXT);
    expect(contrastRatio(brand, colorTokens.bg.surface[theme])).toBeGreaterThanOrEqual(
      AA_BODY_TEXT,
    );
  });

  it.each(statusColors)("status %s is readable on the surface colour", (_name, color) => {
    expect(contrastRatio(color[theme], colorTokens.bg.surface[theme])).toBeGreaterThanOrEqual(
      AA_BODY_TEXT,
    );
  });
});
