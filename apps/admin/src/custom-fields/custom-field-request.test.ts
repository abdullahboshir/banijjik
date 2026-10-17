import { describe, expect, it } from "vitest";
import {
  buildCustomFieldsRequest,
  customFieldErrorsOf,
  editableFieldsOf,
  initialValuesOf,
} from "./custom-field-request";
import { staffProfileFields } from "./test-fixtures";

const FIELDS = staffProfileFields();
const STORED = { emergency_contact: "+8801712345678", nid: "1234567890", medical_notes: "asthma" };

function request(values: Record<string, unknown>, canSeeSensitive: boolean) {
  return buildCustomFieldsRequest({ fields: FIELDS, stored: STORED, values, canSeeSensitive });
}

describe("editableFieldsOf", () => {
  it("leaves out a sensitive field the person may not read", () => {
    const keys = editableFieldsOf(FIELDS, false).map((field) => field.fieldKey);

    expect(keys).toEqual(["emergency_contact", "blood_group", "nid"]);
  });

  it("leaves out a field hidden from the admin", () => {
    const hidden = FIELDS.map((field) => ({
      ...field,
      visibility: { admin: false, storefront: true, bot: false },
    }));

    expect(editableFieldsOf(hidden, true)).toEqual([]);
  });
});

describe("initialValuesOf", () => {
  it("starts from the saved values of the fields the person may edit", () => {
    const values = initialValuesOf({ fields: FIELDS, stored: STORED, canSeeSensitive: false });

    expect(values).toEqual({ emergency_contact: "+8801712345678", nid: "1234567890" });
  });
});

describe("buildCustomFieldsRequest", () => {
  it("sends nothing when nothing changed", () => {
    const unchanged = initialValuesOf({ fields: FIELDS, stored: STORED, canSeeSensitive: true });

    expect(request(unchanged, true)).toEqual({ ok: true, customFields: {} });
  });

  it("sends only the fields that changed", () => {
    const values = { ...STORED, blood_group: "A_POS" };

    expect(request(values, true)).toEqual({ ok: true, customFields: { blood_group: "A_POS" } });
  });

  it("sends null for a saved optional field the person emptied", () => {
    const values = { ...STORED, emergency_contact: "" };

    expect(request(values, true)).toEqual({ ok: true, customFields: { emergency_contact: null } });
  });

  it("does not send an emptied field that was never saved", () => {
    const stored = { emergency_contact: "+8801712345678", nid: "1234567890" };
    const values = { ...stored, blood_group: "" };

    const result = buildCustomFieldsRequest({
      fields: FIELDS,
      stored,
      values,
      canSeeSensitive: true,
    });

    expect(result).toEqual({ ok: true, customFields: {} });
  });

  it("never sends a sensitive field to someone who may not read it, even if the values hold one", () => {
    const values = {
      emergency_contact: "+8801712345678",
      nid: "1234567890",
      medical_notes: "[redacted]",
    };

    expect(request(values, false)).toEqual({ ok: true, customFields: {} });
  });

  it("asks for a required field that is empty, at that field", () => {
    const values = { emergency_contact: "+8801712345678", nid: "" };

    expect(request(values, true)).toEqual({ ok: false, errors: { nid: "validation.required" } });
  });

  it("reports a value the shared rules refuse, at that field", () => {
    const values = { ...STORED, emergency_contact: "abc" };

    const result = request(values, true);

    expect(result.ok).toBe(false);
    expect(result.ok ? {} : Object.keys(result.errors)).toEqual(["emergency_contact"]);
  });
});

describe("customFieldErrorsOf", () => {
  it("places the customFields.<key> errors of the API on their fields and ignores the rest", () => {
    const details = {
      fields: [
        { path: "customFields.nid", messageKey: "validation.too_big" },
        { path: "name", messageKey: "validation.required" },
        { path: "customFields.nid", messageKey: "validation.custom" },
        "not a field",
      ],
    };

    expect(customFieldErrorsOf(details)).toEqual({ nid: "validation.too_big" });
  });

  it("returns nothing when the refusal names no fields", () => {
    expect(customFieldErrorsOf(undefined)).toEqual({});
  });
});
