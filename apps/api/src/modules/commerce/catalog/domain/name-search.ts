const ZERO_WIDTH_JOINERS = /[‌‍]/g;
const WHITESPACE_RUNS = /\s+/g;

/**
 * The searchable copy of a name or a word: lower-cased and Bangla-folded, so a prefix typed on any
 * keyboard finds the stored text. Folding means canonical (NFC) composition, which makes "য়" typed
 * as one letter equal to "য" plus the dot sign, and removing the invisible joiners that some
 * keyboards add. The same function folds the typed query, so both sides always agree.
 */
export function foldText(text: string): string {
  return text
    .normalize("NFC")
    .replace(ZERO_WIDTH_JOINERS, "")
    .replace(WHITESPACE_RUNS, " ")
    .trim()
    .toLowerCase();
}
