import { describe, expect, it } from "vitest";
import { customFieldIsValid, emptyCustomField } from "./blank-configuration";

function field(override: object) {
  return { ...emptyCustomField(), label: { bn: "লেবেল", en: "Label" }, ...override };
}

describe("customFieldIsValid", () => {
  it("accepts a text field with both labels", () => {
    expect(customFieldIsValid(field({ fieldKey: "nid_number" }))).toBe(true);
  });

  it("rejects a bad key, options on text, missing labels and a link without reference", () => {
    expect(customFieldIsValid(field({ fieldKey: "NID" }))).toBe(false);
    expect(customFieldIsValid(field({ fieldKey: "nid_number", options: ["a"] }))).toBe(false);
    expect(customFieldIsValid(field({ fieldKey: "nid_number", label: { bn: "", en: "" } }))).toBe(
      false,
    );
    expect(
      customFieldIsValid(
        field({
          fieldKey: "nid_number",
          link: { relationKey: "GUARDIAN_OF", createIfMissingByPhone: true, defaultBillTo: false },
        }),
      ),
    ).toBe(false);
  });
});
