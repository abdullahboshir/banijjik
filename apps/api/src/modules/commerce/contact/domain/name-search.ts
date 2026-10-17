const ZERO_WIDTH_JOINERS = /[‌‍]/g;
const WHITESPACE_RUNS = /\s+/g;

/**
 * The searchable copy of a name: lower-cased and Bangla-folded, so a prefix typed on any keyboard
 * finds the stored name. Folding means canonical (NFC) composition, which makes "য়" typed as one
 * letter equal to "য" plus the dot sign, and removing the invisible joiners that some keyboards add.
 * The same function folds the typed query, so both sides always agree.
 */
export function foldName(name: string): string {
  return name
    .normalize("NFC")
    .replace(ZERO_WIDTH_JOINERS, "")
    .replace(WHITESPACE_RUNS, " ")
    .trim()
    .toLowerCase();
}
