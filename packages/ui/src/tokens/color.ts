export interface ColorValue {
  readonly light: string;
  readonly dark: string;
}

/**
 * Semantic colours of docs/13-UX.md section 8.1 (ADR-057, ADR-058).
 * Light values are applied at launch. Dark values are defined for every token now so that turning
 * dark mode on later is a setting, not a code change. Every text pair is checked by color.test.ts.
 */
export const colorTokens = {
  brand: {
    primary: { light: "#0F766E", dark: "#2DD4BF" },
    primaryHover: { light: "#115E59", dark: "#5EEAD4" },
    onPrimary: { light: "#FFFFFF", dark: "#042F2E" },
  },
  bg: {
    app: { light: "#F8FAFC", dark: "#020617" },
    surface: { light: "#FFFFFF", dark: "#0F172A" },
    subtle: { light: "#F1F5F9", dark: "#1E293B" },
  },
  border: {
    default: { light: "#E2E8F0", dark: "#334155" },
  },
  text: {
    primary: { light: "#0F172A", dark: "#F1F5F9" },
    secondary: { light: "#475569", dark: "#CBD5E1" },
    muted: { light: "#94A3B8", dark: "#94A3B8" },
  },
  status: {
    success: { light: "#15803D", dark: "#4ADE80" },
    warning: { light: "#B45309", dark: "#FBBF24" },
    danger: { light: "#B91C1C", dark: "#F87171" },
    info: { light: "#1D4ED8", dark: "#60A5FA" },
    neutral: { light: "#64748B", dark: "#94A3B8" },
  },
} as const satisfies Record<string, Record<string, ColorValue>>;

export type ColorTheme = keyof ColorValue;

export interface FlatColorToken {
  /** Dotted semantic name such as "brand.primary". */
  readonly name: string;
  readonly value: ColorValue;
}

export function flattenColorTokens(): FlatColorToken[] {
  return Object.entries(colorTokens).flatMap(([group, members]) =>
    Object.entries(members).map(([member, value]) => ({ name: `${group}.${member}`, value })),
  );
}

/**
 * The platform panel's own accent (13-UX section 12): it replaces the three brand tokens in apps/platform
 * only, so operators always know they are not in a tenant's dashboard. Every other token is shared.
 * The values are copied into apps/platform/app/globals.css; a test there keeps both in step, and
 * color.test.ts checks every pair for WCAG AA.
 */
export const platformAccentTokens = {
  primary: { light: "#4338CA", dark: "#A5B4FC" },
  primaryHover: { light: "#3730A3", dark: "#C7D2FE" },
  onPrimary: { light: "#FFFFFF", dark: "#1E1B4B" },
} as const satisfies Record<string, ColorValue>;
