const ZERO_WIDTH_JOINERS = /[‌‍]/g;
const WHITESPACE_RUNS = /\s+/g;

export function foldName(name: string): string {
  return name
    .normalize("NFC")
    .replace(ZERO_WIDTH_JOINERS, "")
    .replace(WHITESPACE_RUNS, " ")
    .trim()
    .toLowerCase();
}
