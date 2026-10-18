import { describe, expect, it } from "vitest";
import { entriesOfRows, rowsOfEntries } from "./synonym-entries";

describe("synonym rows", () => {
  it("shows the other words as one comma-separated text", () => {
    expect(rowsOfEntries([{ term: "shirt", synonyms: ["top", "জামা"] }])).toEqual([
      { term: "shirt", wordsText: "top, জামা" },
    ]);
  });

  it("sends trimmed, distinct words and drops rows that are not complete", () => {
    const entries = entriesOfRows([
      { term: " shirt ", wordsText: "top, top ,, জামা" },
      { term: "", wordsText: "x" },
      { term: "pant", wordsText: " " },
    ]);

    expect(entries).toEqual([{ term: "shirt", synonyms: ["top", "জামা"] }]);
  });
});
