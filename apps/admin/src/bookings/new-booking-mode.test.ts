import type { ResourceResponse } from "@banijjik/contracts/booking";
import type { OfferingResponse } from "@banijjik/contracts/catalog";
import { describe, expect, it } from "vitest";
import type { EventSessionView } from "./event-session-api";
import {
  bookingModeOf,
  isPositiveWholeNumber,
  rentalDetailsOf,
  rentalResourcesOf,
  seatsLeftOf,
  sellableSessionsOf,
} from "./new-booking-mode";

function offeringOf(kind: string, kindDetails: Record<string, unknown> = {}): OfferingResponse {
  return { offeringId: "o", kind, kindDetails, variants: [] } as unknown as OfferingResponse;
}

function resourceOf(resourceTypeKey: string, status = "ACTIVE"): ResourceResponse {
  return { resourceId: resourceTypeKey + status, resourceTypeKey, status } as ResourceResponse;
}

function sessionOf(patch: Partial<EventSessionView>): EventSessionView {
  return {
    eventSessionId: "s",
    offeringId: "o",
    variantId: "v",
    locationId: "l",
    startsAt: "2026-12-01T04:00:00.000Z",
    endsAt: "2026-12-01T06:00:00.000Z",
    capacity: 10,
    seatsSold: 0,
    status: "SCHEDULED",
    version: 1,
    ...patch,
  };
}

describe("new booking sheet modes", () => {
  it("picks rental mode for a rental and event mode for an event offering", () => {
    expect(bookingModeOf(offeringOf("RENTAL"))).toBe("RENTAL");
    expect(bookingModeOf(offeringOf("EVENT"))).toBe("EVENT");
    expect(bookingModeOf(offeringOf("SERVICE"))).toBe("SLOT");
    expect(bookingModeOf(undefined)).toBe("SLOT");
  });

  it("reads rental details only from a rental offering", () => {
    const rental = offeringOf("RENTAL", {
      rateUnit: "DAY",
      minUnits: 2,
      resourceTypeKeys: ["ROOM"],
    });
    expect(rentalDetailsOf(rental)?.minUnits).toBe(2);
    expect(rentalDetailsOf(offeringOf("EVENT"))).toBeUndefined();
  });

  it("offers a rental only the active resources of its resource types", () => {
    const rental = rentalDetailsOf(
      offeringOf("RENTAL", { rateUnit: "DAY", minUnits: 1, resourceTypeKeys: ["ROOM"] }),
    );
    const chosen = rentalResourcesOf(
      [resourceOf("ROOM"), resourceOf("ROOM", "ARCHIVED"), resourceOf("CAR")],
      rental,
    );
    expect(chosen.map((resource) => resource.resourceTypeKey)).toEqual(["ROOM"]);
  });

  it("lists only upcoming scheduled sessions of the chosen ticket type", () => {
    const now = new Date("2026-11-20T00:00:00.000Z");
    const sessions = [
      sessionOf({ eventSessionId: "ok" }),
      sessionOf({ eventSessionId: "other-variant", variantId: "x" }),
      sessionOf({ eventSessionId: "cancelled", status: "CANCELLED" }),
      sessionOf({ eventSessionId: "past", startsAt: "2026-11-01T04:00:00.000Z" }),
    ];
    expect(
      sellableSessionsOf(sessions, { variantId: "v", now }).map((s) => s.eventSessionId),
    ).toEqual(["ok"]);
  });

  it("counts seats left from the session, never below zero", () => {
    expect(seatsLeftOf(sessionOf({ capacity: 10, seatsSold: 4 }))).toBe(6);
    expect(seatsLeftOf(sessionOf({ capacity: 3, seatsSold: 5 }))).toBe(0);
  });

  it("accepts only whole numbers of units or seats from one up", () => {
    expect(isPositiveWholeNumber("2")).toBe(true);
    expect(isPositiveWholeNumber("0")).toBe(false);
    expect(isPositiveWholeNumber("1.5")).toBe(false);
    expect(isPositiveWholeNumber("")).toBe(false);
  });
});
