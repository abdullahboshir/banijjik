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
