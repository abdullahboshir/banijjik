import type { Translator } from "@banijjik/i18n";

/** Texts of the categories and add-ons screens, read once on the server (the browser bundle has no screen catalog). */
export const CATEGORY_LABEL_KEYS = [
  "categories.title",
  "categories.subtitle",
  "categories.add",
  "categories.name",
  "categories.parent",
  "categories.topLevel",
  "categories.empty",
  "categories.moveUp",
  "categories.moveDown",
  "categories.edit",
  "categories.save",
  "categories.archive",
  "categories.close",
  "categories.rowLabel",
  "categories.conflict",
  "categories.reload",
  "categories.readOnly",
  "synonyms.title",
  "synonyms.help",
  "synonyms.term",
  "synonyms.words",
  "synonyms.add",
  "synonyms.remove",
  "synonyms.save",
  "synonyms.saved",
  "synonyms.empty",
] as const;

export const ADD_ON_LABEL_KEYS = [
  "addOns.title",
  "addOns.subtitle",
  "addOns.add",
  "addOns.empty",
  "addOns.name",
  "addOns.selection",
  "addOns.selection.SINGLE",
  "addOns.selection.MULTIPLE",
  "addOns.required",
  "addOns.minSelect",
  "addOns.maxSelect",
  "addOns.optionName",
  "addOns.optionPrice",
  "addOns.addOption",
  "addOns.removeOption",
  "addOns.options",
  "addOns.save",
  "addOns.archive",
  "addOns.edit",
  "addOns.close",
  "addOns.optionsCount",
  "addOns.readOnly",
  "addOns.conflict",
  "addOns.reload",
  "addOns.rule.single",
  "addOns.rule.singleOptional",
  "addOns.rule.multipleRequired",
  "addOns.rule.multipleOptional",
] as const;

export type CategoryLabels = Readonly<Record<(typeof CATEGORY_LABEL_KEYS)[number], string>>;
export type AddOnLabels = Readonly<Record<(typeof ADD_ON_LABEL_KEYS)[number], string>>;

function pick<Key extends string>(t: Translator["t"], keys: readonly Key[]): Record<Key, string> {
  const entries = keys.map((key) => [key, t(`catalog.${key}`)]);
  // Safe: entries has one text for each of the keys.
  return Object.fromEntries(entries) as Record<Key, string>;
}

export function categoryLabelsOf(t: Translator["t"]): CategoryLabels {
  return pick(t, CATEGORY_LABEL_KEYS);
}

export function addOnLabelsOf(t: Translator["t"]): AddOnLabels {
  return pick(t, ADD_ON_LABEL_KEYS);
}
