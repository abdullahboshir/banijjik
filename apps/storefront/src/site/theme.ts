import { brandingThemeStyle, type BrandingColours } from "@banijjik/ui/website";
import type { CSSProperties } from "react";

export type SiteColours = BrandingColours;

/**
 * Brand colours as the semantic tokens of packages/ui (ADR-057). Mapping lives in the shared
 * website theme so preview and SSR cannot drift (card 4.1 B).
 */
export function themeStyle(colours: SiteColours | undefined): CSSProperties {
  return brandingThemeStyle(colours);
}
