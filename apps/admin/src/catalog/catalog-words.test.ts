import { describe, expect, it } from "vitest";
import { banglaTranslator } from "../auth/test-helpers";
import { allKindWords, catalogTitle, kindWord, unitLabels } from "./catalog-words";

const translator = banglaTranslator();

describe("the words of the catalog", () => {
  it("uses the term of the kind when the business renamed it", () => {
    const terms = { "offering.SERVICE": { bn: "সেবা", en: "Treatment" } };

    const source = { terms, kinds: ["SERVICE", "PRODUCT"] as const, translator };

    expect(kindWord(source, "SERVICE")).toBe("সেবা");
    expect(kindWord(source, "PRODUCT")).toBe(translator.t("catalog.kind.PRODUCT"));
  });

  it("calls the only kind of the business by the general term", () => {
    const terms = { offering: { bn: "প্যাকেজ", en: "Package" } };

    const source = { terms, kinds: ["PLAN"] as const, translator };

    expect(kindWord(source, "PLAN")).toBe("প্যাকেজ");
    expect(catalogTitle(source)).toBe("প্যাকেজ");
  });

  it("falls back to the plain Catalog title and the default kind words", () => {
    const source = { terms: {}, kinds: ["PRODUCT"] as const, translator };

    expect(catalogTitle(source)).toBe(translator.t("catalog.title"));
    expect(allKindWords(source).EVENT).toBe(translator.t("catalog.kind.EVENT"));
  });

  it("names every unit in Bangla", () => {
    expect(unitLabels(translator.t).KG).toBe("কেজি");
    expect(
      Object.values(unitLabels(translator.t)).every((name) => !name.startsWith("catalog.")),
    ).toBe(true);
  });
});
