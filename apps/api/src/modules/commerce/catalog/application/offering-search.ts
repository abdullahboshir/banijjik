import { foldText } from "../domain/name-search.js";
import type { OfferingSearch } from "./ports/offering-repository.js";
import type { SynonymBook } from "./ports/record-ports.js";

/** Enough for any real synonym list; a flood of expansions would only slow the query. */
const MAX_PREFIXES = 40;

/**
 * Turns the typed term into what the repository matches. The term itself is a prefix; so is every
 * word the organization's synonym list ties to it, in either direction: typing "চাল" also finds
 * names starting with "rice" when the list says চাল means rice (and the other way round).
 */
export function buildOfferingSearch(term: string, synonyms: SynonymBook): OfferingSearch {
  const folded = foldText(term);
  const prefixes = new Set<string>([folded]);
  for (const entry of synonyms.entries) {
    const words = [foldText(entry.term), ...entry.synonyms.map(foldText)];
    if (!words.includes(folded)) continue;
    for (const word of words) prefixes.add(word);
  }
  return { prefixes: [...prefixes].slice(0, MAX_PREFIXES), exact: term.trim() };
}
