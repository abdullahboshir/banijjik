import { newId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { eventSessionCreateSchema } from "./event-session-schemas.js";

const base = {
  offeringId: newId(),
  variantId: newId(),
  locationId: newId(),
  startsAt: "2026-11-01T09:00:00.000Z",
  endsAt: "2026-11-01T10:00:00.000Z",
  capacity: 10,
};

describe("event session resource validation", () => {
  it("rejects more than ten resources on an event session", () => {
    const result = eventSessionCreateSchema.safeParse({
      ...base,
      resourceIds: Array.from({ length: 11 }, () => newId()),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a resource named twice on an event session", () => {
    const resourceId = newId();
    const result = eventSessionCreateSchema.safeParse({
      ...base,
      resourceIds: [resourceId, resourceId],
    });
    expect(result.success).toBe(false);
  });
});
