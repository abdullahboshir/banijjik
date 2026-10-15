import type { Translator } from "@banijjik/i18n";

/** Prefixes of `details.removed`. The catalog coverage test requires each one. */
export const REMOVED_ITEM_LABEL_KEYS = [
  "platform.removed.kind",
  "platform.removed.module",
  "platform.removed.customField",
  "platform.removed.fieldType",
  "platform.removed.referenceEntity",
  "platform.removed.link",
  "platform.removed.option",
  "platform.removed.term",
  "platform.removed.contactRole",
  "platform.removed.relation",
  "platform.removed.resourceType",
] as const;

const FIELD_CATEGORIES = new Set(["customField", "fieldType", "referenceEntity", "link"]);
const IDENTITY_SEPARATORS = 3;

/** `skin_type` and `PRODUCT` become "Skin type" and "Product". */
function plainName(value: string): string {
  const words = value
    .toLowerCase()
    .split("_")
    .filter((word) => word.length > 0);
  const [first, ...rest] = words;
  if (first === undefined) return value;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
}

function fieldKeyOf(identity: string): string {
  const parts = identity.split(":");
  return parts[2] ?? identity;
}

function nthSeparator(value: string, count: number): number {
  let seen = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== ":") continue;
    seen += 1;
    if (seen === count) return index;
  }
  return -1;
}

function nameOf(category: string, rest: string): string {
  return plainName(FIELD_CATEGORIES.has(category) ? fieldKeyOf(rest) : rest);
}

/**
 * One `details.removed` token in plain words (ADR-101).
 * `module:booking` → "Module: Booking"; `fieldType:contact::skin_type` → "Field type of Skin type".
 */
export function formatRemovedItem(token: string, t: Translator["t"]): string {
  const splitAt = token.indexOf(":");
  if (splitAt <= 0) return token;
  const category = token.slice(0, splitAt);
  const rest = token.slice(splitAt + 1);
  const key = `platform.removed.${category}`;
  if (category === "option") return t(key, optionValues(rest));
  return t(key, { name: nameOf(category, rest) });
}

function optionValues(rest: string): { name: string; option: string } {
  const splitAt = nthSeparator(rest, IDENTITY_SEPARATORS);
  if (splitAt < 0) return { name: plainName(rest), option: "" };
  return {
    name: plainName(fieldKeyOf(rest.slice(0, splitAt))),
    option: rest.slice(splitAt + 1),
  };
}
