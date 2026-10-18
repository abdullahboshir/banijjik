import {
  MAX_ORGANIZATION_SYNONYM_TERMS,
  MAX_SYNONYM_LENGTH,
  type SynonymEntry,
} from "@banijjik/contracts/catalog";

/** One row of the synonym editor: the word and its other words as one comma-separated text. */
export interface SynonymRow {
  term: string;
  wordsText: string;
}

export function rowsOfEntries(entries: readonly SynonymEntry[]): SynonymRow[] {
  return entries.map((entry) => ({ term: entry.term, wordsText: entry.synonyms.join(", ") }));
}

function splitWords(text: string): string[] {
  const words = text
    .split(/[,،\n]/u)
    .map((word) => word.trim().slice(0, MAX_SYNONYM_LENGTH))
    .filter((word) => word !== "");
  return [...new Set(words)];
}

/** The entries to send: rows without a word or without other words are dropped; the list is capped at the API limit. */
export function entriesOfRows(rows: readonly SynonymRow[]): SynonymEntry[] {
  return rows
    .map((row) => ({
      term: row.term.trim().slice(0, MAX_SYNONYM_LENGTH),
      synonyms: splitWords(row.wordsText),
    }))
    .filter((entry) => entry.term !== "" && entry.synonyms.length > 0)
    .slice(0, MAX_ORGANIZATION_SYNONYM_TERMS);
}
