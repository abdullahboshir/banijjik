import { OFFERING_KIND, type OfferingKind } from "@banijjik/contracts";
import { UNIT_KEY, type UnitKey } from "@banijjik/contracts/catalog";
import type { Translator } from "@banijjik/i18n";
import { termLabel, type TermTexts } from "@banijjik/web-client";

/** What the catalog screens need to name things in the business own words (ADR-104). */
export interface CatalogWordSource {
  terms: TermTexts;
  /** The kinds the business offers; a business with one kind may call it just "offering". */
  kinds: readonly OfferingKind[];
  translator: Translator;
}

/** "Service", "Plan", "Product": the business own word for the kind, else the default word. */
export function kindWord(source: CatalogWordSource, kind: OfferingKind): string {
  const { translator, terms, kinds } = source;
  const fallback = translator.t(`catalog.kind.${kind}`);
  const locale = translator.locale;
  const general =
    kinds.length === 1 ? termLabel(terms, "offering", { locale, fallback }) : fallback;
  return termLabel(terms, `offering.${kind}`, { locale, fallback: general });
}

/** The title of the list: the term `offering` ("সেবা"), else "Catalog". */
export function catalogTitle(source: CatalogWordSource): string {
  const { translator, terms } = source;
  return termLabel(terms, "offering", {
    locale: translator.locale,
    fallback: translator.t("catalog.title"),
  });
}

export function unitLabels(t: Translator["t"]): Record<UnitKey, string> {
  const entries = Object.values(UNIT_KEY).map((unitKey) => [unitKey, t(`catalog.unit.${unitKey}`)]);
  return Object.fromEntries(entries) as Record<UnitKey, string>;
}

export function allKindWords(source: CatalogWordSource): Record<OfferingKind, string> {
  const entries = Object.values(OFFERING_KIND).map((kind) => [kind, kindWord(source, kind)]);
  return Object.fromEntries(entries) as Record<OfferingKind, string>;
}
