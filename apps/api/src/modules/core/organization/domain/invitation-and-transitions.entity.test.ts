import { ALL_LOCATIONS, INVITATION_STATUS, MEMBER_STATUS } from "@banijjik/contracts";
import { asId, newId, type OrganizationId, type RoleId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { Invitation } from "./invitation.entity.js";
import { Member } from "./member.entity.js";

const NOW = new Date("2026-10-11T08:00:00.000Z");
const ORGANIZATION_ID = asId<OrganizationId>(newId());
const INVITER = asId<UserId>(newId());
const ASSIGNMENTS = [{ locationId: ALL_LOCATIONS, roleId: asId<RoleId>(newId()) }] as const;

function anInvitation(identifier: { email?: string; phoneE164?: string }): Invitation {
  return Invitation.issue({
    organizationId: ORGANIZATION_ID,
    email: identifier.email,
    phoneE164: identifier.phoneE164,
    displayName: undefined,
    assignments: ASSIGNMENTS,
    invitedByUserId: INVITER,
    tokenHash: "a".repeat(64),
    now: NOW,
  });
}

function aMember(): Member {
  return Member.joinActive({
    organizationId: ORGANIZATION_ID,
    userId: asId<UserId>(newId()),
    displayName: "Rahim",
    assignments: ASSIGNMENTS,
    employeeNumber: "1",
    createdByUserId: null,
    now: NOW,
  });
}

describe("Invitation", () => {
  it("expires seven days after it was issued", () => {
    const invitation = anInvitation({ email: "a@example.com" });

    expect(invitation.expiresAt.toISOString()).toBe("2026-10-18T08:00:00.000Z");
    expect(invitation.statusAt(new Date("2026-10-18T07:59:59.000Z"))).toBe(
      INVITATION_STATUS.PENDING,
    );
    expect(invitation.statusAt(new Date("2026-10-18T08:00:00.000Z"))).toBe(
      INVITATION_STATUS.EXPIRED,
    );
  });

  it("needs exactly one identifier", () => {
    expect(() => anInvitation({})).toThrow();
    expect(() => anInvitation({ email: "a@example.com", phoneE164: "+8801711000111" })).toThrow();
  });

  it("matches the invited email or phone number and nothing else", () => {
    const byEmail = anInvitation({ email: "a@example.com" });
    const byPhone = anInvitation({ phoneE164: "+8801711000111" });

    expect(byEmail.isAddressedTo({ email: "a@example.com", phoneE164: undefined })).toBe(true);
    expect(byEmail.isAddressedTo({ email: "b@example.com", phoneE164: "+8801711000111" })).toBe(
      false,
    );
    expect(byPhone.isAddressedTo({ email: undefined, phoneE164: "+8801711000111" })).toBe(true);
    expect(byPhone.isAddressedTo({ email: "a@example.com", phoneE164: undefined })).toBe(false);
  });

  it("masks the identifier in its hint", () => {
    expect(anInvitation({ email: "rahim@example.com" }).identifierHint()).toBe("r***@example.com");
    expect(anInvitation({ phoneE164: "+8801711000111" }).identifierHint()).toBe("***111");
  });

  it("can be accepted or revoked only while pending", () => {
    const invitation = anInvitation({ email: "a@example.com" });
    const accepted = invitation.accept(asId<UserId>(newId()), NOW);

    expect(accepted.status).toBe(INVITATION_STATUS.ACCEPTED);
    expect(() => accepted.revoke(NOW)).toThrow();
    expect(() => accepted.accept(asId<UserId>(newId()), NOW)).toThrow();
    expect(() =>
      invitation.accept(asId<UserId>(newId()), new Date("2026-11-01T00:00:00Z")),
    ).toThrow();
  });
});

describe("Member transitions", () => {
  it("suspends, reactivates and removes along the allowed paths", () => {
    const member = aMember();

    expect(member.suspend().status).toBe(MEMBER_STATUS.SUSPENDED);
    expect(member.suspend().reactivate().status).toBe(MEMBER_STATUS.ACTIVE);
    expect(member.remove().status).toBe(MEMBER_STATUS.REMOVED);
    expect(member.suspend().remove().status).toBe(MEMBER_STATUS.REMOVED);
  });

  it.each([
    ["reactivate an active member", (member: Member) => member.reactivate()],
    ["suspend a suspended member", (member: Member) => member.suspend().suspend()],
    ["suspend a removed member", (member: Member) => member.remove().suspend()],
    [
      "edit a removed member",
      (member: Member) => member.remove().withChanges({ displayName: "X" }),
    ],
    [
      "rejoin an active member",
      (member: Member) => member.rejoin({ displayName: "X", assignments: ASSIGNMENTS, now: NOW }),
    ],
  ])("refuses to %s", (_description, attempt) => {
    expect(() => attempt(aMember())).toThrow(
      expect.objectContaining({ code: "INVALID_TRANSITION" }),
    );
  });

  it("brings a removed member back with the same id and new assignments", () => {
    const removed = aMember().remove();

    const back = removed.rejoin({ displayName: "Rahim again", assignments: ASSIGNMENTS, now: NOW });

    expect(back).toMatchObject({
      memberId: removed.memberId,
      status: MEMBER_STATUS.ACTIVE,
      displayName: "Rahim again",
    });
  });
});
