import { describe, expect, it } from "vitest";
import type { StorefrontListingField } from "@banijjik/contracts/directory";
import { translatorFor } from "../i18n/client-translator";
import { fieldValueText } from "./field-value";

const GENDER_FIELD: StorefrontListingField = {
  fieldKey: "gender",
  label: { bn: "লিঙ্গ", en: "Gender" },
  fieldType: "SELECT",
  isRequired: true,
  options: ["female", "male"],
  optionLabels: { female: { bn: "মহিলা", en: "Female" }, male: { bn: "পুরুষ", en: "Male" } },
  isFilterable: true,
  sortOrder: 1,
};

describe("listing field value text", () => {
  it("shows the option label, never the stored option key", () => {
    const text = fieldValueText({
      field: GENDER_FIELD,
      value: "female",
      locale: "en",
      translator: translatorFor("en"),
    });

    expect(text).toBe("Female");
  });

  it("shows nothing for an empty value", () => {
    expect(
      fieldValueText({
        field: GENDER_FIELD,
        value: "",
        locale: "en",
        translator: translatorFor("en"),
      }),
    ).toBeUndefined();
    expect(
      fieldValueText({
        field: GENDER_FIELD,
        value: undefined,
        locale: "en",
        translator: translatorFor("en"),
      }),
    ).toBeUndefined();
  });
});
