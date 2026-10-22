import { describe, expect, it } from "vitest";
import { newId } from "@banijjik/ids";
import {
  enrollmentCreateRequestSchema,
  enrollmentVersionRequestSchema,
  enrollmentListQuerySchema,
  checkInCreateRequestSchema,
} from "./index.js";

describe("enrollment request validation", () => {
  const create = {
    contactId: newId(),
    locationId: newId(),
    offeringId: newId(),
    variantId: newId(),
    startsOn: "2026-01-31",
  };
  it("accepts a business date and rejects invalid dates and caller-supplied organization ids", () => {
    expect(enrollmentCreateRequestSchema.safeParse(create).success).toBe(true);
    expect(
      enrollmentCreateRequestSchema.safeParse({ ...create, startsOn: "2026-02-30" }).success,
    ).toBe(false);
    expect(
      enrollmentCreateRequestSchema.safeParse({ ...create, organizationId: newId() }).success,
    ).toBe(false);
  });
  it("requires positive versions and bounds paginated overdue queries", () => {
    expect(enrollmentVersionRequestSchema.safeParse({ version: 0 }).success).toBe(false);
    expect(enrollmentListQuerySchema.parse({ overdue: "true", limit: "10" })).toMatchObject({
      overdue: true,
      limit: 10,
      page: 1,
    });
    expect(enrollmentListQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
    expect(enrollmentListQuerySchema.safeParse({ organizationId: newId() }).success).toBe(false);
  });
  it("requires a contact and location and rejects ambiguous enrollment-plus-booking check-in", () => {
    expect(checkInCreateRequestSchema.safeParse({ contactId: newId() }).success).toBe(false);
    expect(
      checkInCreateRequestSchema.safeParse({
        contactId: newId(),
        locationId: newId(),
        enrollmentId: newId(),
        bookingId: newId(),
      }).success,
    ).toBe(false);
  });
});
