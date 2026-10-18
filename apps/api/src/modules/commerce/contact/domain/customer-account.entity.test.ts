import { asId, type ContactId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { CustomerAccount } from "./customer-account.entity.js";

const NOW = new Date("2026-10-18T08:00:00.000Z");
const LATER = new Date("2026-10-18T09:00:00.000Z");
const STAFF = asId<UserId>("0199a3b2-7c11-7a3e-9d5e-1f2e3d4c5b6a");

function anAccount(): CustomerAccount {
  return CustomerAccount.createVerified({
    contactId: asId<ContactId>("0199a3b2-7c11-7a3e-9d5e-aaaaaaaaaaaa"),
    phoneE164: "+8801712345678",
    now: NOW,
  });
}

describe("CustomerAccount", () => {
  it("starts active and verified, at version 1", () => {
    const account = anAccount();

    expect(account.isActive()).toBe(true);
    expect(account.verifiedAt).toEqual(NOW);
    expect(account.version).toBe(1);
  });

  it("is blocked by staff, remembering who and when, and unblocked again", () => {
    const blocked = anAccount().block(STAFF, LATER);
    const restored = blocked.unblock();

    expect(blocked.isActive()).toBe(false);
    expect(blocked.blockedAt).toEqual(LATER);
    expect(blocked.blockedByUserId).toBe(STAFF);
    expect(restored.isActive()).toBe(true);
    expect(restored.blockedAt).toBeUndefined();
  });

  it("refuses to block a blocked account or unblock an active one", () => {
    const blocked = anAccount().block(STAFF, LATER);

    expect(() => blocked.block(STAFF, LATER)).toThrow();
    expect(() => anAccount().unblock()).toThrow();
  });
});
