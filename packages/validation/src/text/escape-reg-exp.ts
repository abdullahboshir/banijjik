/** Makes typed text safe to put inside a regular expression, so it matches itself and nothing else. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
