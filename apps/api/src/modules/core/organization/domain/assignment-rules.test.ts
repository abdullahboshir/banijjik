import { ALL_LOCATIONS } from "@banijjik/contracts";
import { asId, newId, type LocationId, type RoleId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import {
  assertCallerHoldsEveryKey,
  assertRolesAreAssignable,
  diffAssignments,
  type CallerKeys,
  type RoleGrant,
  type RoleGrants,
} from "./assignment-rules.js";
import type { Assignment } from "./member.entity.js";

const READ = "organization.member.read";
const UPDATE = "organization.member.update";
const REMOVE = "organization.member.remove";

const LOCATION_ONE = asId<LocationId>(newId());
const LOCATION_TWO = asId<LocationId>(newId());

function aRole(keys: readonly string[], overrides: Partial<RoleGrant> = {}): RoleGrant {
  return {
    roleId: asId<RoleId>(newId()),
    isActive: true,
    isOwnerRole: false,
    permissionKeys: new Set(keys),
    ...overrides,
  };
}

function grantsOf(...roles: RoleGrant[]): RoleGrants {
  return new Map(roles.map((role) => [role.roleId, role]));
}

function assign(role: RoleGrant, locationId: LocationId | typeof ALL_LOCATIONS): Assignment {
  return { locationId, roleId: role.roleId };
}

describe("assertCallerHoldsEveryKey", () => {
  const readUpdate = aRole([READ, UPDATE]);
  const readOnly = aRole([READ]);
  const everything = aRole([READ, UPDATE, REMOVE]);

  const callers: Record<string, CallerKeys> = {
    "holds read and update at ALL": { allLocations: [READ, UPDATE], byLocation: {} },
    "holds read and update at location one only": {
      allLocations: [],
      byLocation: { [LOCATION_ONE]: [READ, UPDATE] },
    },
    "holds read at ALL and update at location one": {
      allLocations: [READ],
      byLocation: { [LOCATION_ONE]: [UPDATE] },
    },
    "holds nothing": { allLocations: [], byLocation: {} },
  };

  function callerNamed(name: string): CallerKeys {
    const caller = callers[name];
    if (caller === undefined) throw new Error(`unknown caller ${name}`);
    return caller;
  }

  type GivenAt = LocationId | typeof ALL_LOCATIONS;
  const rows: [string, RoleGrant, GivenAt, boolean][] = [
    ["holds read and update at ALL", readUpdate, ALL_LOCATIONS, true],
    ["holds read and update at ALL", readUpdate, LOCATION_ONE, true],
    ["holds read and update at ALL", everything, ALL_LOCATIONS, false],
    ["holds read and update at ALL", everything, LOCATION_TWO, false],
    ["holds read and update at location one only", readUpdate, LOCATION_ONE, true],
    ["holds read and update at location one only", readUpdate, LOCATION_TWO, false],
    ["holds read and update at location one only", readUpdate, ALL_LOCATIONS, false],
    ["holds read at ALL and update at location one", readUpdate, LOCATION_ONE, true],
    ["holds read at ALL and update at location one", readUpdate, LOCATION_TWO, false],
    ["holds read at ALL and update at location one", readOnly, LOCATION_TWO, true],
    ["holds nothing", readOnly, LOCATION_ONE, false],
  ];

  it.each(rows)(
    "caller %s, role given at %s: allowed is %s",
    (callerName, role, locationId, allowed) => {
      const caller = callerNamed(callerName);
      const attempt = (): void =>
        assertCallerHoldsEveryKey([assign(role, locationId)], grantsOf(role), caller);

      if (allowed) expect(attempt).not.toThrow();
      else expect(attempt).toThrow(expect.objectContaining({ code: "BUSINESS_RULE" }));
    },
  );

  it("allows a role without any permission key", () => {
    const empty = aRole([]);

    expect(() =>
      assertCallerHoldsEveryKey(
        [assign(empty, ALL_LOCATIONS)],
        grantsOf(empty),
        callerNamed("holds nothing"),
      ),
    ).not.toThrow();
  });
});

describe("assertRolesAreAssignable", () => {
  it("accepts an active role that is not the owner role", () => {
    const role = aRole([READ]);

    expect(() =>
      assertRolesAreAssignable([assign(role, ALL_LOCATIONS)], grantsOf(role)),
    ).not.toThrow();
  });

  it.each([
    ["the owner role", { isOwnerRole: true }],
    ["an archived role", { isActive: false }],
  ])("refuses %s", (_description, overrides) => {
    const role = aRole([READ], overrides);

    expect(() => assertRolesAreAssignable([assign(role, ALL_LOCATIONS)], grantsOf(role))).toThrow(
      expect.objectContaining({
        details: expect.objectContaining({ ruleKey: "ROLE_NOT_GRANTABLE" }),
      }),
    );
  });

  it("refuses a role that does not exist in the organization", () => {
    const unknown = aRole([READ]);

    expect(() => assertRolesAreAssignable([assign(unknown, ALL_LOCATIONS)], grantsOf())).toThrow();
  });
});

describe("diffAssignments", () => {
  it("reports what is added and what is removed, ignoring what stays", () => {
    const kept = aRole([READ]);
    const dropped = aRole([UPDATE]);
    const added = aRole([REMOVE]);

    const change = diffAssignments(
      [assign(kept, LOCATION_ONE), assign(dropped, LOCATION_ONE)],
      [assign(kept, LOCATION_ONE), assign(added, LOCATION_TWO)],
    );

    expect(change.added).toEqual([assign(added, LOCATION_TWO)]);
    expect(change.removed).toEqual([assign(dropped, LOCATION_ONE)]);
  });

  it("treats the same role at another location as a different assignment", () => {
    const role = aRole([READ]);

    const change = diffAssignments([assign(role, LOCATION_ONE)], [assign(role, LOCATION_TWO)]);

    expect(change.added).toHaveLength(1);
    expect(change.removed).toHaveLength(1);
  });
});
