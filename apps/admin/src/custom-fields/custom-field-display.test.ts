import { CUSTOM_FIELD_TYPE } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { banglaTranslator } from "../auth/test-helpers";
import { detailRowsOf } from "./custom-field-display";
import { effectiveField, staffProfileFields } from "./test-fixtures";

const { t } = banglaTranslator();

function rows(values: Record<string, unknown>, canSeeSensitive: boolean) {
  return detailRowsOf({
    fields: staffProfileFields(),
    values,
    canSeeSensitive,
    locale: "bn",
    timeZone: "Asia/Dhaka",
    currencyCode: "BDT",
    t,
  });
}

function noteRow(values: Record<string, unknown>, canSeeSensitive: boolean) {
  return rows(values, canSeeSensitive).find((row) => row.fieldKey === "medical_notes");
}

describe("detailRowsOf", () => {
  it("shows a phone the way people write it and a select by its label", () => {
    const [phone, bloodGroup] = rows(
      { emergency_contact: "+8801712345678", blood_group: "A_POS" },
      true,
    );

    expect(phone?.text).toBe("01712-345678");
    expect(bloodGroup?.text).toBe("এ+");
  });

  it("marks a sensitive field hidden for a person who may not read it, with no text", () => {
    expect(noteRow({ medical_notes: "asthma" }, false)).toMatchObject({
      isHidden: true,
      text: undefined,
    });
  });

  it("shows the sensitive value to a person who may read it", () => {
    expect(noteRow({ medical_notes: "asthma" }, true)).toMatchObject({
      isHidden: false,
      text: "asthma",
    });
  });

  it("leaves a field with no saved value without text", () => {
    const [phone] = rows({}, true);

    expect(phone).toMatchObject({ isHidden: false, text: undefined });
  });

  it("skips a field the admin cannot see and a type with no screen yet", () => {
    const fields = [
      effectiveField({
        fieldKey: "shop_note",
        fieldType: CUSTOM_FIELD_TYPE.TEXT,
        visibility: { admin: false, storefront: true, bot: false },
      }),
      effectiveField({ fieldKey: "stylist", fieldType: CUSTOM_FIELD_TYPE.REFERENCE }),
    ];

    const result = detailRowsOf({
      fields,
      values: {},
      canSeeSensitive: true,
      locale: "bn",
      timeZone: "Asia/Dhaka",
      currencyCode: "BDT",
      t,
    });

    expect(result).toEqual([]);
  });

  it("says that an image or a file is uploaded instead of showing its id", () => {
    const fields = [
      effectiveField({ fieldKey: "photo", fieldType: CUSTOM_FIELD_TYPE.IMAGE }),
      effectiveField({ fieldKey: "scan", fieldType: CUSTOM_FIELD_TYPE.FILE }),
      effectiveField({ fieldKey: "empty_photo", fieldType: CUSTOM_FIELD_TYPE.IMAGE }),
    ];

    const result = detailRowsOf({
      fields,
      values: {
        photo: "0198aaaa-0000-7000-8000-000000000001",
        scan: "0198aaaa-0000-7000-8000-000000000002",
      },
      canSeeSensitive: true,
      locale: "bn",
      timeZone: "Asia/Dhaka",
      currencyCode: "BDT",
      t,
    });

    expect(result.map((row) => row.text)).toEqual([
      t("customFields.fileUploaded"),
      t("customFields.fileUploaded"),
      undefined,
    ]);
  });
});

describe("detailRowsOf contact links (card 3.1b)", () => {
  const guardian = effectiveField({
    fieldKey: "guardian",
    fieldType: CUSTOM_FIELD_TYPE.REFERENCE,
    entityType: "contact",
    referenceEntity: "contact",
    link: { relationKey: "GUARDIAN_OF", createIfMissingByPhone: true, defaultBillTo: true },
  });
  const memberReference = effectiveField({
    fieldKey: "buddy",
    fieldType: CUSTOM_FIELD_TYPE.REFERENCE,
    referenceEntity: "member",
  });
  const input = {
    fields: [guardian, memberReference],
    locale: "bn" as const,
    timeZone: "Asia/Dhaka",
    currencyCode: "BDT",
    canSeeSensitive: true,
    t,
  };

  it("shows the linked contact's name with a link to the contact", () => {
    const result = detailRowsOf({
      ...input,
      values: { guardian: "c-9", buddy: "m-1" },
      linkedContacts: { "c-9": { name: "আব্দুল করিম", href: "/acme/contacts/c-9" } },
    });

    expect(result).toEqual([
      {
        fieldKey: "guardian",
        label: "guardian",
        text: "আব্দুল করিম",
        href: "/acme/contacts/c-9",
        isHidden: false,
      },
    ]);
  });

  it("shows a link whose contact is unknown as not set, and leaves other references out", () => {
    const result = detailRowsOf({ ...input, values: { guardian: "gone" } });

    expect(result.map((row) => [row.fieldKey, row.text])).toEqual([["guardian", undefined]]);
  });
});
