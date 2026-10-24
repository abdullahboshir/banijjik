import {
  asId,
  newId,
  type LocationId,
  type OfferingId,
  type OrganizationId,
  type ResourceId,
} from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { EventSession, MAX_EVENT_SESSION_RESOURCE_DAYS } from "./event-session.entity.js";

const resourceId = asId<ResourceId>(newId());
const base = {
  organizationId: asId<OrganizationId>(newId()),
  offeringId: asId<OfferingId>(newId()),
  variantId: newId(),
  locationId: asId<LocationId>(newId()),
  startsAt: new Date("2026-11-01T09:00:00.000Z"),
  endsAt: new Date("2026-11-01T10:00:00.000Z"),
  capacity: 10,
  resourceIds: [resourceId],
  resourceHolds: [{ resourceId, units: 2 }],
  now: new Date("2026-10-01T00:00:00.000Z"),
  actorUserId: null,
};

describe("EventSession resource holds", () => {
  it("a session with resources longer than thirty-one days is refused", () => {
    expect(() =>
      EventSession.create({
        ...base,
        endsAt: new Date(
          base.startsAt.getTime() + (MAX_EVENT_SESSION_RESOURCE_DAYS + 1) * 86400000,
        ),
      }),
    ).toThrow();
  });

  it("a session without resources may last longer than thirty-one days", () => {
    expect(() =>
      EventSession.create({
        ...base,
        resourceIds: [],
        resourceHolds: [],
        endsAt: new Date(base.startsAt.getTime() + 60 * 86400000),
      }),
    ).not.toThrow();
  });

  it("cancel clears the resource holds and complete keeps them", () => {
    const session = EventSession.create(base);
    expect(session.cancel(base.now, null).toProps().resourceHolds).toEqual([]);
    expect(
      session.complete(new Date("2026-11-02T00:00:00.000Z"), null).toProps().resourceHolds,
    ).toEqual(base.resourceHolds);
  });

  it("holds that do not match the resource ids are refused", () => {
    expect(() =>
      EventSession.create({
        ...base,
        resourceHolds: [{ resourceId: asId<ResourceId>(newId()), units: 1 }],
      }),
    ).toThrow();
  });

  it("a capacity edit of a session created before holds existed keeps its empty holds", () => {
    const legacy = EventSession.rehydrate({
      ...EventSession.create(base).toProps(),
      resourceHolds: [],
    });

    const edited = legacy.update({ capacity: 12, now: base.now, actorUserId: null });

    expect(edited.toProps().resourceHolds).toEqual([]);
  });
});
