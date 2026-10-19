import { describe, expect, it } from "vitest";
import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "./audit-action.js";

describe("audit vocabulary", () => {
  it("names every action <module>.<entity>.<pastTenseVerb>", () => {
    for (const action of Object.values(AUDIT_ACTION)) {
      expect(action).toMatch(/^[a-z-]+\.[a-z][A-Za-z]*\.[a-z]+ed$/);
    }
  });

  it("has no duplicate actions", () => {
    const actions = Object.values(AUDIT_ACTION);
    expect(new Set(actions).size).toBe(actions.length);
  });

  it("lists the entity types of the modules that exist", () => {
    expect(Object.keys(AUDIT_ENTITY_TYPE)).toEqual([
      "organization",
      "location",
      "member",
      "invitation",
      "role",
      "approvalPin",
      "approvalToken",
      "customFieldDefinition",
      "customFieldPreference",
      "setting",
      "termOverride",
      "moduleOverride",
      "contact",
      "offering",
      "offeringLocation",
      "category",
      "modifierGroup",
      "searchSynonym",
      "customerAccount",
      "expense",
      "expenseCategory",
      "journalEntry",
      "account",
    ]);
  });
});
