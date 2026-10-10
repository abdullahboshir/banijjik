export function parseOrIgnore(text: string): void {
  try {
    JSON.parse(text);
  } catch {}
}
