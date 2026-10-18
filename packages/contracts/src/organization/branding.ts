/**
 * The rules of a business's branding (card 3.12, ADR-114). Both the API and the admin screen read
 * them from here, so the screen can never accept what the API refuses.
 */
export const BRANDING_RULES = {
  /** `#RRGGBB`; the API stores it lower-cased. */
  colorPattern: /^#[0-9a-fA-F]{6}$/,
  taglineMaxLength: 80,
  /** The primary colour is a button background under white text (WCAG AA, normal text). */
  primaryMinContrast: 4.5,
  /** The accent colour is used for links, badges and borders on white (WCAG AA, large text and graphics). */
  accentMinContrast: 3,
} as const;

const HEX_CHANNEL_STARTS = [1, 3, 5] as const;
const WHITE = "#ffffff";
const SRGB_LINEAR_THRESHOLD = 0.03928;

function channelLuminance(channel: number): number {
  const scaled = channel / 255;
  return scaled <= SRGB_LINEAR_THRESHOLD ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a `#RRGGBB` colour. */
function relativeLuminance(hex: string): number {
  const [red = 0, green = 0, blue = 0] = HEX_CHANNEL_STARTS.map((start) =>
    Number.parseInt(hex.slice(start, start + 2), 16),
  );
  return (
    0.2126 * channelLuminance(red) +
    0.7152 * channelLuminance(green) +
    0.0722 * channelLuminance(blue)
  );
}

function contrastRatio(foreground: string, background: string): number {
  const luminances = [relativeLuminance(foreground), relativeLuminance(background)];
  const [lighter = 0, darker = 0] = luminances.sort((first, second) => second - first);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The one copy of the colour checks, used by the API (it refuses a pale colour) and by the admin
 * screen (it warns while the owner types). It lives in contracts, not in the zod-based validation
 * package, so the browser bundle does not pull the schema library for it (13-UX section 11).
 */
export const BRAND_CHECKS = {
  /** WCAG contrast ratio of two `#RRGGBB` colours, from 1 (identical) to 21 (black on white). */
  contrastRatio,
  /** True when a primary colour carries white button text at AA. */
  isReadablePrimaryColor: (hex: string): boolean =>
    contrastRatio(hex, WHITE) >= BRANDING_RULES.primaryMinContrast,
  /** True when an accent colour is visible as a link, badge or border on white. */
  isVisibleAccentColor: (hex: string): boolean =>
    contrastRatio(hex, WHITE) >= BRANDING_RULES.accentMinContrast,
} as const;

/** A named colour pair the screen offers before "Custom". Every pair passes the rules above (tested). */
export interface BrandColorPreset {
  readonly presetKey: string;
  readonly primaryColor: string;
  readonly accentColor: string;
}

export const BRAND_COLOR_PRESETS: readonly BrandColorPreset[] = [
  { presetKey: "green", primaryColor: "#15803d", accentColor: "#16a34a" },
  { presetKey: "teal", primaryColor: "#0f766e", accentColor: "#0d9488" },
  { presetKey: "blue", primaryColor: "#1d4ed8", accentColor: "#2563eb" },
  { presetKey: "indigo", primaryColor: "#4338ca", accentColor: "#4f46e5" },
  { presetKey: "purple", primaryColor: "#7e22ce", accentColor: "#9333ea" },
  { presetKey: "rose", primaryColor: "#be123c", accentColor: "#e11d48" },
  { presetKey: "orange", primaryColor: "#c2410c", accentColor: "#ea580c" },
  { presetKey: "slate", primaryColor: "#334155", accentColor: "#475569" },
];
