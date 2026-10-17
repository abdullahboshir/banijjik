import { CONTACT_SOURCE, CONTACT_STATUS, CONTACT_TYPE } from "@banijjik/contracts/contact";
import { newId, type OrganizationId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { Contact } from "./contact.entity.js";
import { foldName } from "./name-search.js";

const NOW = new Date("2026-10-17T00:00:00Z");

function aContact(overrides: Partial<Parameters<typeof Contact.create>[0]> = {}): Contact {
  return Contact.create({
    organizationId: newId() as OrganizationId,
    contactType: CONTACT_TYPE.PERSON,
    name: "Rahim",
    phoneE164: "+8801712345678",
    contactRoles: ["CUSTOMER"],
    source: CONTACT_SOURCE.MANUAL,
    createdByUserId: newId() as UserId,
    now: NOW,
    ...overrides,
  });
}

describe("Contact", () => {
  it("needs a name or a phone", () => {
    expect(() => aContact({ name: undefined, phoneE164: undefined })).toThrow();
    expect(aContact({ name: undefined }).phoneE164).toBe("+8801712345678");
  });

  it("clears an optional field with null and keeps it when the key is absent", () => {
    const contact = aContact({ email: "a@b.co" });

    expect(contact.withChanges({ email: null }).email).toBeUndefined();
    expect(contact.withChanges({ name: "Karim" }).email).toBe("a@b.co");
  });

  it("refuses to clear the last of name and phone", () => {
    expect(() => aContact().withChanges({ name: null, phoneE164: null })).toThrow();
  });

  it("is read-only once archived", () => {
    const archived = aContact().archive();

    expect(archived.status).toBe(CONTACT_STATUS.ARCHIVED);
    expect(() => archived.withChanges({ name: "X" })).toThrow();
  });

  it("anonymizes once: personal data goes, the id and relations stay", () => {
    const related = { relatedContactId: newId(), relationKey: "GUARDIAN_OF" } as const;
    const contact = aContact({ email: "a@b.co" }).withRelation(related);

    const erased = contact.anonymize(NOW);

    expect(erased).toMatchObject({
      contactId: contact.contactId,
      name: undefined,
      status: "ARCHIVED",
    });
    expect(erased.relations).toEqual([related]);
    expect(() => erased.anonymize(NOW)).toThrow();
  });

  it("adds a relation once", () => {
    const related = { relatedContactId: newId(), relationKey: "GUARDIAN_OF" } as const;

    expect(aContact().withRelation(related).withRelation(related).relations).toHaveLength(1);
  });
});

describe("foldName", () => {
  it("lower-cases, drops joiners and composes Bangla letters so both keyboards match", () => {
    expect(foldName("  SULTANA  Begum ")).toBe("sultana begum");
    expect(foldName("\u09af\u09bc")).toBe(foldName("\u09df"));
    expect(foldName("ক\u200dষ")).toBe("কষ");
  });
});
