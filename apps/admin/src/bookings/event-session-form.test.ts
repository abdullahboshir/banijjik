import { describe, expect, it } from "vitest";
import type { EventSessionView } from "./event-session-api";
import {
  buildEventSessionCreate,
  buildEventSessionUpdate,
  emptyEventSessionForm,
  eventSessionFormOf,
} from "./event-session-form";

const TIME_ZONE = "Asia/Dhaka";
const IDS = {
  offering: "01900000-0000-7000-8000-000000000010",
  variant: "01900000-0000-7000-8000-000000000011",
  location: "01900000-0000-7000-8000-000000000001",
  session: "01900000-0000-7000-8000-000000000012",
};

function sessionView(patch: Partial<EventSessionView> = {}): EventSessionView {
  return {
    eventSessionId: IDS.session,
    offeringId: IDS.offering,
    variantId: IDS.variant,
    locationId: IDS.location,
    startsAt: "2026-11-01T04:00:00.000Z",
    endsAt: "2026-11-01T06:00:00.000Z",
    capacity: 10,
    seatsSold: 0,
    status: "SCHEDULED",
    version: 3,
    ...patch,
  };
}

describe("event session create form", () => {
  it("builds a create body with the times read in the organization timezone", () => {
    const form = {
      ...emptyEventSessionForm(IDS.location),
      offeringId: IDS.offering,
      variantId: IDS.variant,
      startsAtLocal: "2026-11-01T10:00",
      endsAtLocal: "2026-11-01T12:00",
      capacity: "20",
    };
    const built = buildEventSessionCreate(form, TIME_ZONE);
    expect(built).toMatchObject({
      ok: true,
      body: {
        startsAt: "2026-11-01T04:00:00.000Z",
        endsAt: "2026-11-01T06:00:00.000Z",
        capacity: 20,
      },
    });
  });

  it("names the missing fields and refuses an end before the start", () => {
    const built = buildEventSessionCreate(
      {
        ...emptyEventSessionForm(IDS.location),
        startsAtLocal: "2026-11-01T10:00",
        endsAtLocal: "2026-11-01T09:00",
      },
      TIME_ZONE,
    );
    expect(built).toMatchObject({
      ok: false,
      errors: {
        offeringId: "validation.required",
        capacity: "validation.required",
        endsAt: "validation.too_small",
      },
    });
  });
});

describe("event session edit form", () => {
  it("sends the new capacity with the version and no time when the time did not change", () => {
    const session = sessionView();
    const form = { ...eventSessionFormOf(session, TIME_ZONE), capacity: "25" };
    expect(buildEventSessionUpdate(form, session, TIME_ZONE)).toEqual({
      ok: true,
      body: { version: 3, capacity: 25 },
    });
  });

  it("refuses a capacity below the seats already sold", () => {
    const session = sessionView({ seatsSold: 4 });
    const form = { ...eventSessionFormOf(session, TIME_ZONE), capacity: "3" };
    expect(buildEventSessionUpdate(form, session, TIME_ZONE)).toMatchObject({
      ok: false,
      errors: { capacity: "validation.too_small" },
    });
  });

  it("never sends a time change once seats are sold", () => {
    const session = sessionView({ seatsSold: 2 });
    const form = {
      ...eventSessionFormOf(session, TIME_ZONE),
      startsAtLocal: "2026-11-02T10:00",
      capacity: "12",
    };
    expect(buildEventSessionUpdate(form, session, TIME_ZONE)).toEqual({
      ok: true,
      body: { version: 3, capacity: 12 },
    });
  });
});
