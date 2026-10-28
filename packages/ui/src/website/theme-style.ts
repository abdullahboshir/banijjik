import { BRANDING_RULES } from "@banijjik/contracts";
import {
  BORDER_TOKEN,
  DENSITY_TOKEN,
  IMAGE_RATIO_TOKEN,
  RADIUS_TOKEN,
  SHADOW_TOKEN,
  TYPE_SCALE,
  type SiteTokens,
} from "@banijjik/contracts/website";
import type { CSSProperties } from "react";
import { radiusTokens } from "../tokens/radius.js";
import { shadowTokens } from "../tokens/shadow.js";
import { spaceTokens } from "../tokens/space.js";

type ThemeVariable = `--${string}`;
export type SiteThemeStyle = CSSProperties & Record<ThemeVariable, string>;

export interface BrandingColours {
  readonly primary: string | null;
  readonly accent: string | null;
}

const RADIUS_CSS = {
  [RADIUS_TOKEN.NONE]: "0",
  [RADIUS_TOKEN.SMALL]: radiusTokens.sm,
  [RADIUS_TOKEN.MEDIUM]: radiusTokens.md,
  [RADIUS_TOKEN.LARGE]: radiusTokens.lg,
} as const;

const SHADOW_CSS = {
  [SHADOW_TOKEN.NONE]: "none",
  [SHADOW_TOKEN.LOW]: shadowTokens.sm,
  [SHADOW_TOKEN.MEDIUM]: shadowTokens.md,
} as const;

const DENSITY_CSS = {
  [DENSITY_TOKEN.COMPACT]: spaceTokens["3"],
  [DENSITY_TOKEN.COMFORTABLE]: spaceTokens["4"],
  [DENSITY_TOKEN.SPACIOUS]: spaceTokens["6"],
} as const;

const RATIO_CSS = {
  [IMAGE_RATIO_TOKEN.SQUARE]: "1 / 1",
  [IMAGE_RATIO_TOKEN.PORTRAIT]: "3 / 4",
  [IMAGE_RATIO_TOKEN.LANDSCAPE]: "16 / 9",
} as const;

const SCALE_CSS = {
  [TYPE_SCALE.SMALL]: "0.95",
  [TYPE_SCALE.MEDIUM]: "1",
  [TYPE_SCALE.LARGE]: "1.125",
} as const;

const BORDER_CSS = {
  [BORDER_TOKEN.NONE]: "0",
  [BORDER_TOKEN.THIN]: "1px",
  [BORDER_TOKEN.MEDIUM]: "2px",
} as const;

const CARD_SIZE_CSS = { SMALL: "12rem", MEDIUM: "16rem", LARGE: "20rem" } as const;

const COLOR_VARS: readonly {
  readonly token: keyof SiteTokens["color"];
  readonly css: ThemeVariable;
  readonly brand?: ThemeVariable;
}[] = [
  { token: "primary", css: "--site-color-primary", brand: "--color-brand-primary" },
  { token: "accent", css: "--site-color-accent", brand: "--color-brand-accent" },
  { token: "background", css: "--site-color-background" },
  { token: "surface", css: "--site-color-surface" },
  { token: "text", css: "--site-color-text" },
  { token: "mutedText", css: "--site-color-muted" },
  { token: "onPrimary", css: "--site-color-on-primary" },
  { token: "focus", css: "--site-color-focus" },
];

/** A colour that is not `#RRGGBB` is ignored so untrusted CSS never reaches the page. */
export function usableHexColour(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const trimmed = value.trim();
  return BRANDING_RULES.colorPattern.test(trimmed) ? trimmed : undefined;
}

function assignColour(style: SiteThemeStyle, name: ThemeVariable, value: string): void {
  const hex = usableHexColour(value);
  if (hex === undefined) return;
  style[name] = hex;
}

/**
 * Brand colours for the existing storefront shell. Invalid values are dropped so the platform
 * default stays (card 3.12).
 */
export function brandingThemeStyle(colours: BrandingColours | undefined): SiteThemeStyle {
  const style: SiteThemeStyle = {};
  assignColour(style, "--color-brand-primary", colours?.primary ?? "");
  assignColour(style, "--site-color-primary", colours?.primary ?? "");
  assignColour(style, "--color-brand-accent", colours?.accent ?? "");
  assignColour(style, "--site-color-accent", colours?.accent ?? "");
  return style;
}

/** Fixed CSS variables from a validated token document. Values are never concatenated as CSS. */
export function siteThemeStyle(tokens: SiteTokens): SiteThemeStyle {
  const style: SiteThemeStyle = {};
  for (const mapping of COLOR_VARS) {
    assignColour(style, mapping.css, tokens.color[mapping.token]);
    if (mapping.brand !== undefined)
      assignColour(style, mapping.brand, tokens.color[mapping.token]);
  }
  style["--site-radius-card"] = RADIUS_CSS[tokens.shape.cardRadius];
  style["--site-radius-button"] = RADIUS_CSS[tokens.shape.buttonRadius];
  style["--site-radius-input"] = RADIUS_CSS[tokens.shape.inputRadius];
  style["--site-radius-image"] = RADIUS_CSS[tokens.shape.imageRadius];
  style["--site-border-width"] = BORDER_CSS[tokens.shape.border];
  style["--site-shadow"] = SHADOW_CSS[tokens.shape.shadow];
  style["--site-space"] = DENSITY_CSS[tokens.spacing.density];
  style["--site-image-ratio"] = RATIO_CSS[tokens.size.imageRatio];
  style["--site-card-size"] = CARD_SIZE_CSS[tokens.size.cardSize];
  style["--site-columns-mobile"] = String(tokens.size.columns.mobile);
  style["--site-columns-tablet"] = String(tokens.size.columns.tablet);
  style["--site-columns-desktop"] = String(tokens.size.columns.desktop);
  style["--site-type-scale"] = SCALE_CSS[tokens.type.scale];
  return style;
}
