import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** Utility names of the `--text-*` sizes in styles/theme.css. */
const FONT_SIZE_UTILITIES = ["display", "display-lg", "title", "body", "small", "caption"];

/**
 * Without this, tailwind-merge reads `text-body` as a colour and drops it whenever a colour such as
 * `text-primary` follows it.
 */
const mergeClasses = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: FONT_SIZE_UTILITIES }] } },
});

export function cn(...inputs: ClassValue[]): string {
  return mergeClasses(clsx(inputs));
}
