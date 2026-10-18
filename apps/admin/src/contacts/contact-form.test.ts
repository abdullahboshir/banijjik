import { describe, expect, it } from "vitest";
import {
  buildContactCreate,
  buildContactUpdate,
  emptyContactForm,
  formOfContact,
  type ContactFormInitial,
} from "./contact-form";

const SAVED: ContactFormInitial = {
  contactId: "c-1",
  version: 4,
  name: "রহিম",
  phone: "+8801712345678",
  email: "",
  roles: ["CUSTOMER"],
};

describe("buildContactCreate", () => {
  it("builds the create body from the typed text, leaving empty inputs out", () => {
    const form = { ...emptyContactForm(["CUSTOMER"]), name: " রহিম ", phone: "01712345678" };

    const result = buildContactCreate(form, { class_level: "SSC" });

    expect(result).toEqual({
      ok: true,
      body: {
        contactType: "PERSON",
        contactRoles: ["CUSTOMER"],
        name: "রহিম",
        phoneE164: "01712345678",
        customFields: { class_level: "SSC" },
      },
    });
  });

  it("needs a name or a phone, a real phone, a real email and a role", () => {
    const empty = buildContactCreate({ ...emptyContactForm([]) }, {});
    const bad = buildContactCreate(
      { ...emptyContactForm(["CUSTOMER"]), phone: "123", email: "not-an-email" },
      {},
    );

    expect(empty).toEqual({
      ok: false,
      fieldErrors: { name: "contacts.form.nameOrPhone", contactRoles: "validation.too_small" },
    });
    expect(bad).toEqual({
      ok: false,
      fieldErrors: { phoneE164: "validation.invalid_format", email: "validation.invalid_format" },
    });
  });

  it("accepts a phone alone", () => {
    const result = buildContactCreate({ ...emptyContactForm(["LEAD"]), phone: "01812345678" }, {});

    expect(result.ok).toBe(true);
  });
});

describe("buildContactUpdate", () => {
  it("sends nothing when nothing changed", () => {
    expect(buildContactUpdate(formOfContact(SAVED), SAVED, {})).toEqual({
      ok: true,
      body: undefined,
    });
  });

  it("sends only what changed with the version it read, and null for an emptied text", () => {
    const form = {
      ...formOfContact(SAVED),
      name: "করিম",
      phone: "",
      roles: ["CUSTOMER" as const, "LEAD" as const],
    };

    const result = buildContactUpdate(form, SAVED, {});

    expect(result).toEqual({
      ok: true,
      body: { name: "করিম", phoneE164: null, contactRoles: ["CUSTOMER", "LEAD"], version: 4 },
    });
  });

  it("refuses to empty both the name and the phone", () => {
    const form = { ...formOfContact(SAVED), name: "", phone: "" };

    expect(buildContactUpdate(form, SAVED, {})).toMatchObject({
      ok: false,
      fieldErrors: { name: "contacts.form.nameOrPhone" },
    });
  });
});
