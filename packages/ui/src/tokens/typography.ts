export interface FontSize {
  readonly size: string;
  readonly lineHeight: string;
}

/** Sizes in rem so layouts scale to 200% text zoom (13-UX section 10). Nothing is below 12px. */
export const fontSizeTokens = {
  displayMobile: { size: "1.5rem", lineHeight: "2rem" },
  displayDesktop: { size: "1.875rem", lineHeight: "2.375rem" },
  title: { size: "1.125rem", lineHeight: "1.75rem" },
  body: { size: "1rem", lineHeight: "1.625rem" },
  small: { size: "0.875rem", lineHeight: "1.375rem" },
  caption: { size: "0.75rem", lineHeight: "1.125rem" },
} as const satisfies Record<string, FontSize>;

export const fontWeightTokens = {
  regular: "400",
  semibold: "600",
} as const;

/** Bangla body text needs a taller line because conjunct glyphs are taller (13-UX section 7). */
export const BANGLA_LINE_HEIGHT = "1.6";
