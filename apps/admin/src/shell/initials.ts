const MAX_INITIALS = 2;
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function firstLetter(word: string): string {
  // Segmenting by grapheme keeps a Bangla letter together with its vowel sign instead of cutting it in half.
  const [first] = graphemeSegmenter.segment(word);
  return first?.segment ?? "";
}

/** The first letters of the first two words of a name, for the round account button. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, MAX_INITIALS)
    .map(firstLetter)
    .join("");
}
