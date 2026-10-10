import { ALL_LOCATIONS } from "@banijjik/contracts";
import {
  newId,
  type LocationId,
  type OrganizationId,
  type RoleId,
  type UserId,
} from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { DomainRuleError } from "./errors.js";
import { Location, type LocationProps } from "./location.entity.js";
import { Member, type Assignment, type NewActiveMemberInput } from "./member.entity.js";

const NOW = new Date("2026-10-11T08:00:00.000Z");
const organizationId = newId() as OrganizationId;
const userId = newId() as UserId;
const roleId = newId() as RoleId;

function aDefaultLocation(overrides: Partial<LocationProps> = {}): Location {
  const created = Location.createDefault({
    organizationId,
    name: "Rahim Store",
    district: "Dhaka",
    createdByUserId: userId,
    now: NOW,
  });
  return Location.restore({ ...created, ...overrides });
}

function aMemberInput(assignments: readonly Assignment[]): NewActiveMemberInput {
  return {
    organizationId,
    userId,
    displayName: "Rahim Uddin",
    assignments,
    employeeNumber: "1",
    createdByUserId: userId,
    now: NOW,
  };
}

function fieldPathOf(action: () => unknown): string | undefined {
  try {
    action();
  } catch (error) {
    if (!(error instanceof DomainRuleError)) return undefined;
    // Safe: invalidField() always builds details.fields in this shape.
    const fields = error.details?.["fields"] as { path: string }[] | undefined;
    return fields?.[0]?.path;
  }
  return undefined;
}

describe("Location.createDefault", () => {
  it("is an active default store named after the organization, with the district as its address", () => {
    const location = aDefaultLocation();

    expect(location).toMatchObject({
      organizationId,
      name: "Rahim Store",
      locationType: "STORE",
      isDefault: true,
      status: "ACTIVE",
      address: { district: "Dhaka" },
      version: 1,
    });
    expect(location.timezone).toBeUndefined();
  });

  it("has no address when no district is given", () => {
    const location = Location.createDefault({
      organizationId,
      name: "Rahim Store",
      district: undefined,
      createdByUserId: userId,
      now: NOW,
    });

    expect(location.address).toBeUndefined();
  });

  it("rejects an empty name and a name over 80 characters", () => {
    const create = (name: string): Location =>
      Location.createDefault({
        organizationId,
        name,
        district: undefined,
        createdByUserId: userId,
        now: NOW,
      });

    expect(fieldPathOf(() => create("   "))).toBe("name");
    expect(fieldPathOf(() => create("x".repeat(81)))).toBe("name");
  });
});

describe("Member.joinActive", () => {
  it("creates an active member with the given assignments and joined time", () => {
    const member = Member.joinActive(aMemberInput([{ locationId: ALL_LOCATIONS, roleId }]));

    expect(member).toMatchObject({
      status: "ACTIVE",
      displayName: "Rahim Uddin",
      employeeNumber: "1",
      joinedAt: NOW,
      assignments: [{ locationId: "ALL", roleId }],
      version: 1,
    });
  });

  it("rejects an active member without any assignment", () => {
    expect(fieldPathOf(() => Member.joinActive(aMemberInput([])))).toBe("assignments");
  });

  it("rejects two assignments for the same location", () => {
    const locationId = newId() as LocationId;

    const create = (): Member =>
      Member.joinActive(
        aMemberInput([
          { locationId, roleId },
          { locationId, roleId: newId() as RoleId },
        ]),
      );

    expect(fieldPathOf(create)).toBe("assignments");
  });

  it("rejects ALL combined with a specific location", () => {
    const create = (): Member =>
      Member.joinActive(
        aMemberInput([
          { locationId: ALL_LOCATIONS, roleId },
          { locationId: newId() as LocationId, roleId },
        ]),
      );

    expect(fieldPathOf(create)).toBe("assignments");
  });

  it("rejects a blank display name", () => {
    const create = (): Member =>
      Member.joinActive({
        ...aMemberInput([{ locationId: ALL_LOCATIONS, roleId }]),
        displayName: "  ",
      });

    expect(fieldPathOf(create)).toBe("displayName");
  });
});

describe("Member.assertLocationsAreActive", () => {
  it("accepts ALL without any location, and a specific active location of the same organization", () => {
    const location = aDefaultLocation();
    const allMember = Member.joinActive(aMemberInput([{ locationId: ALL_LOCATIONS, roleId }]));
    const oneMember = Member.joinActive(
      aMemberInput([{ locationId: location.locationId, roleId }]),
    );

    expect(() => allMember.assertLocationsAreActive([])).not.toThrow();
    expect(() => oneMember.assertLocationsAreActive([location])).not.toThrow();
  });

  it("rejects an unknown, archived or foreign location", () => {
    const location = aDefaultLocation();
    const member = Member.joinActive(aMemberInput([{ locationId: location.locationId, roleId }]));
    const archived = aDefaultLocation({ locationId: location.locationId, status: "ARCHIVED" });
    const foreign = aDefaultLocation({
      locationId: location.locationId,
      organizationId: newId() as OrganizationId,
    });

    expect(fieldPathOf(() => member.assertLocationsAreActive([]))).toBe("assignments");
    expect(fieldPathOf(() => member.assertLocationsAreActive([archived]))).toBe("assignments");
    expect(fieldPathOf(() => member.assertLocationsAreActive([foreign]))).toBe("assignments");
  });
});
