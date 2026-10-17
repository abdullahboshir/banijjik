/** Flat by default: borders come before shadows (13-UX section 8.4). */
export const shadowTokens = {
  sm: "0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.04)",
  md: "0 4px 12px -2px rgb(15 23 42 / 0.12)",
  lg: "0 12px 32px -4px rgb(15 23 42 / 0.2)",
} as const;
