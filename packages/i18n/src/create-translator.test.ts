import {
  IAM_MESSAGE_KEYS,
  ORGANIZATION_MESSAGE_KEYS,
  SYSTEM_ROLE_NAME_MESSAGE_KEYS,
  KERNEL_ERROR_MESSAGE_KEYS,
  VALIDATION_MESSAGE_KEYS,
} from "@banijjik/contracts";
import { describe, expect, it, vi } from "vitest";
import { BUNDLED_CATALOGS } from "./bundled-catalogs.js";
import { createTranslator } from "./create-translator.js";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./locales.js";

const BRAND_FOR_TESTS = "টেস্ট ব্র্যান্ড";
function placeholdersOf(text: string): string[] {
  return [...text.matchAll(/\{[^}]+\}/g)].map((match) => match[0]).sort();
}

describe("bundled catalogs", () => {
  it("have exactly the same key set in bn and en", () => {
    expect(Object.keys(BUNDLED_CATALOGS.bn).sort()).toEqual(
      Object.keys(BUNDLED_CATALOGS.en).sort(),
    );
  });

  it("use the same placeholders in bn and en for every key", () => {
    for (const [key, text] of Object.entries(BUNDLED_CATALOGS.bn)) {
      expect(placeholdersOf(text), key).toEqual(placeholdersOf(BUNDLED_CATALOGS.en[key] ?? ""));
    }
  });

  it("have a message in both languages for every key the kernel, the iam module and the organization module can send to a client", () => {
    const emittedKeys = [
      ...KERNEL_ERROR_MESSAGE_KEYS,
      ...VALIDATION_MESSAGE_KEYS,
      ...IAM_MESSAGE_KEYS,
      ...ORGANIZATION_MESSAGE_KEYS,
      ...SYSTEM_ROLE_NAME_MESSAGE_KEYS,
    ];
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of emittedKeys) {
        expect(BUNDLED_CATALOGS[locale][key], `${locale} ${key}`).toBeTruthy();
      }
    }
  });

  it("never contain the brand name, which comes from config (ADR-038)", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(JSON.stringify(BUNDLED_CATALOGS[locale])).not.toMatch(/banijjik/i);
    }
  });
});

describe("createTranslator", () => {
  it("defaults to Bangla", () => {
    expect(DEFAULT_LOCALE).toBe("bn");
    expect(SUPPORTED_LOCALES).toEqual(["bn", "en"]);
  });

  it("translates a key in the requested locale", () => {
    const bangla = createTranslator({ locale: "bn", brandName: BRAND_FOR_TESTS });
    const english = createTranslator({ locale: "en", brandName: BRAND_FOR_TESTS });
    expect(bangla.t("common.cancel")).toBe("বাতিল");
    expect(english.t("common.cancel")).toBe("Cancel");
  });

  it("applies a term override inside another key's text", () => {
    const translator = createTranslator({
      locale: "bn",
      brandName: BRAND_FOR_TESTS,
      terms: { "term.contact.singular": "ছাত্র" },
    });
    expect(translator.t("state.empty.contact")).toBe("এখনো কোনো ছাত্র নেই");
  });

  it("falls back to the default term when there is no override", () => {
    const translator = createTranslator({ locale: "bn", brandName: BRAND_FOR_TESTS });
    expect(translator.t("state.empty.contact")).toBe("এখনো কোনো গ্রাহক নেই");
  });

  it("fills {brand} from the brand name option", () => {
    const translator = createTranslator({ locale: "bn", brandName: BRAND_FOR_TESTS });
    expect(translator.t("errors.org_suspended")).toContain(BRAND_FOR_TESTS);
    expect(translator.t("errors.org_suspended")).not.toContain("{brand}");
  });

  it("interpolates named values and keeps unknown placeholders visible", () => {
    const translator = createTranslator({
      locale: "en",
      brandName: BRAND_FOR_TESTS,
      catalogs: { en: { "greeting.custom": "Hello {name}, you have {count} orders {missing}" } },
    });
    expect(translator.t("greeting.custom", { name: "Rahim", count: 3 })).toBe(
      "Hello Rahim, you have 3 orders {missing}",
    );
  });

  it("does not expand placeholders found inside inserted values", () => {
    const translator = createTranslator({
      locale: "en",
      brandName: BRAND_FOR_TESTS,
      catalogs: { en: { "greeting.custom": "Hello {name}" } },
    });
    expect(translator.t("greeting.custom", { name: "{brand}" })).toBe("Hello {brand}");
  });

  it("returns the key and reports it when a key is missing", () => {
    const onMissingKey = vi.fn();
    const translator = createTranslator({ locale: "bn", brandName: BRAND_FOR_TESTS, onMissingKey });
    expect(translator.t("no.such.key")).toBe("no.such.key");
    expect(onMissingKey).toHaveBeenCalledWith("no.such.key", "bn");
  });
});
