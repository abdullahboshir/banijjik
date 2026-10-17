import { BRANDING_RULES } from "@banijjik/contracts";

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

/** WCAG contrast ratio of two `#RRGGBB` colours, from 1 (identical) to 21 (black on white). */
export function contrastRatio(foreground: string, background: string): number {
  const luminances = [relativeLuminance(foreground), relativeLuminance(background)];
  const [lighter = 0, darker = 0] = luminances.sort((first, second) => second - first);
  return (lighter + 0.05) / (darker + 0.05);
}

/** True when a primary colour carries white button text at AA (card 3.12, ADR-114). */
export function isReadablePrimaryColor(hex: string): boolean {
  return contrastRatio(hex, WHITE) >= BRANDING_RULES.primaryMinContrast;
}

/** True when an accent colour is visible as a link, badge or border on white. */
export function isVisibleAccentColor(hex: string): boolean {
  return contrastRatio(hex, WHITE) >= BRANDING_RULES.accentMinContrast;
}
