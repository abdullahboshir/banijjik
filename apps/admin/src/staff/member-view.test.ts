import type { CallerPermissionsResponse } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import {
  canEditMemberDetails,
  locationNamesOfMember,
  memberActionsFor,
  roleNamesOfMember,
  type MemberActionContext,
  type MemberLookups,
} from "./member-view";
import {
  FIRST_LOCATION_ID,
  MANAGER_ROLE_ID,
  OWNER_ROLE_ID,
  ROLES,
  STAFF_ROLE_ID,
  translate,
} from "./test-fixtures";

const LOOKUPS: MemberLookups = {
  roleById: new Map(ROLES.map((entry) => [entry.roleId, entry])),
  locationNameById: new Map([[FIRST_LOCATION_ID, "মূল শাখা"]]),
};
const MANAGER_PERMISSIONS: CallerPermissionsResponse = {
  allLocations: ["organization.member.update", "organization.member.remove"],
  byLocation: {},
};
const READER_ONLY: CallerPermissionsResponse = {
  allLocations: ["organization.member.read"],
  byLocation: {},
};

function context(overrides: Partial<MemberActionContext> = {}): MemberActionContext {
  return {
    member: {
      status: "ACTIVE",
      userId: "someone-else",
      assignments: [{ roleId: STAFF_ROLE_ID, locationId: FIRST_LOCATION_ID }],
    },
    lookups: LOOKUPS,
    callerUserId: "me",
    permissions: MANAGER_PERMISSIONS,
    canWrite: true,
    canChooseAssignments: true,
    ...overrides,
  };
}

describe("memberActionsFor", () => {
  it("offers edit, suspend and remove for an active member to a caller who may", () => {
    expect(memberActionsFor(context())).toEqual(["editAssignments", "suspend", "remove"]);
  });

  it("offers reactivate instead of suspend for a suspended member", () => {
    const suspended = context({
      member: { status: "SUSPENDED", userId: "x", assignments: [] },
    });
    expect(memberActionsFor(suspended)).toEqual(["editAssignments", "reactivate", "remove"]);
  });

  it("offers nothing without the permissions", () => {
    expect(memberActionsFor(context({ permissions: READER_ONLY }))).toEqual([]);
  });

  it("offers only remove to a caller who may remove but not update", () => {
    const removeOnly = { allLocations: ["organization.member.remove" as const], byLocation: {} };
    expect(memberActionsFor(context({ permissions: removeOnly }))).toEqual(["remove"]);
  });

  it("hides every write action in read-only mode", () => {
    expect(memberActionsFor(context({ canWrite: false }))).toEqual([]);
  });

  it("offers nothing for the owner or for oneself, which the API refuses", () => {
    const owner = context({
      member: {
        status: "ACTIVE",
        userId: "boss",
        assignments: [{ roleId: OWNER_ROLE_ID, locationId: "ALL" }],
      },
    });
    const myself = context({ callerUserId: "someone-else" });
    expect(memberActionsFor(owner)).toEqual([]);
    expect(memberActionsFor(myself)).toEqual([]);
  });

  it("leaves out editing when the roles or locations could not be read", () => {
    expect(memberActionsFor(context({ canChooseAssignments: false }))).toEqual([
      "suspend",
      "remove",
    ]);
  });
});

describe("member names", () => {
  const member = {
    assignments: [
      { roleId: MANAGER_ROLE_ID, locationId: "ALL" },
      { roleId: STAFF_ROLE_ID, locationId: FIRST_LOCATION_ID },
      { roleId: STAFF_ROLE_ID, locationId: FIRST_LOCATION_ID },
    ],
  };

  it("lists each role and each location once", () => {
    expect(roleNamesOfMember(member, LOOKUPS, translate)).toBe("ম্যানেজার, স্টাফ");
    expect(locationNamesOfMember(member, LOOKUPS, translate)).toBe("সব শাখা, মূল শাখা");
  });
});

describe("canEditMemberDetails", () => {
  const base = context();

  it("is offered to a caller who may update members, for an active or suspended member", () => {
    expect(canEditMemberDetails(base)).toBe(true);
    expect(canEditMemberDetails({ ...base, member: { ...base.member, status: "SUSPENDED" } })).toBe(
      true,
    );
  });

  it("is hidden for a removed member, in read-only mode and without the permission", () => {
    expect(canEditMemberDetails({ ...base, member: { ...base.member, status: "REMOVED" } })).toBe(
      false,
    );
    expect(canEditMemberDetails({ ...base, canWrite: false })).toBe(false);
    expect(canEditMemberDetails({ ...base, permissions: READER_ONLY })).toBe(false);
  });

  it("is hidden for the owner's record unless the owner is the one looking", () => {
    const owner = {
      ...base.member,
      assignments: [{ roleId: OWNER_ROLE_ID, locationId: FIRST_LOCATION_ID }],
    };

    expect(canEditMemberDetails({ ...base, member: owner })).toBe(false);
    expect(canEditMemberDetails({ ...base, member: { ...owner, userId: "me" } })).toBe(true);
  });

  it("lets a person edit their own details, which they cannot do for their assignments", () => {
    const self = { ...base.member, userId: "me" };

    expect(canEditMemberDetails({ ...base, member: self })).toBe(true);
  });
});
