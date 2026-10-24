import { BRANDING_RULES } from "@banijjik/contracts";
import type { CSSProperties } from "react";

export interface SiteColours {
  readonly primary: string | null;
  readonly accent: string | null;
}

type ThemeVariable = `--${string}`;

/**
 * Brand colours as the semantic tokens of packages/ui (ADR-057). A colour that is not a six-digit hex code
 * is ignored, so the platform default stays. The accent is the storefront's link colour and falls back
 * to the primary colour in the stylesheet.
 */
export function themeStyle(colours: SiteColours | undefined): CSSProperties {
  const style: CSSProperties & Record<ThemeVariable, string> = {};
  const primary = usableColour(colours?.primary);
  const accent = usableColour(colours?.accent);
  if (primary !== undefined) style["--color-brand-primary"] = primary;
  if (accent !== undefined) style["--color-brand-accent"] = accent;
  return style;
}

function usableColour(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const trimmed = value.trim();
  return BRANDING_RULES.colorPattern.test(trimmed) ? trimmed : undefined;
}
