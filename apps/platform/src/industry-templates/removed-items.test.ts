import type { Translator } from "@banijjik/i18n";
import { describe, expect, it } from "vitest";
import { formatRemovedItem } from "./removed-items";

const TEMPLATES: Record<string, string> = {
  "platform.removed.kind": "Kind: {name}",
  "platform.removed.module": "Module: {name}",
  "platform.removed.customField": "Field: {name}",
  "platform.removed.fieldType": "Field type of {name}",
  "platform.removed.referenceEntity": "Reference of {name}",
  "platform.removed.link": "Link of {name}",
  "platform.removed.option": "Option {option} of {name}",
  "platform.removed.term": "Term: {name}",
  "platform.removed.contactRole": "Contact role: {name}",
  "platform.removed.relation": "Relation: {name}",
  "platform.removed.resourceType": "Resource type: {name}",
};

const english = ((key: string, values?: Readonly<Record<string, string | number>>) => {
  const template = TEMPLATES[key] ?? key;
  return template.replace(/\{(\w+)\}/gu, (_match, name: string) => String(values?.[name] ?? ""));
}) as Translator["t"];

describe("formatRemovedItem", () => {
  it.each([
    ["kind:PRODUCT", "Kind: Product"],
    ["module:booking", "Module: Booking"],
    ["customField:contact::allergies", "Field: Allergies"],
    ["fieldType:contact::skin_type", "Field type of Skin type"],
    ["referenceEntity:offering:PRODUCT:guardian", "Reference of Guardian"],
    ["link:contact::guardian", "Link of Guardian"],
    ["option:contact::skin_type:oily", "Option oily of Skin type"],
    ["term:offering", "Term: Offering"],
    ["contactRole:CUSTOMER", "Contact role: Customer"],
    ["relation:GUARDIAN_OF", "Relation: Guardian of"],
    ["resourceType:CHAIR", "Resource type: Chair"],
  ])("says %s as %s", (token, expected) => {
    expect(formatRemovedItem(token, english)).toBe(expected);
  });
});
