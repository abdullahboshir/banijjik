import { expect } from "vitest";
import { money, offeringsPath } from "./catalog-world.js";
import type { ApiActor } from "./two-organizations.js";

export async function publishBookableService(
  actor: ApiActor,
  organizationId: string,
): Promise<{
  offeringId: string;
  version: number;
  variants: { variantId: string }[];
}> {
  const created = await actor.call("post", offeringsPath(organizationId), {
    kind: "SERVICE",
    name: "Haircut",
    kindDetails: {
      durationMinutes: 30,
      requiresResource: true,
      resourceTypeKeys: ["STYLIST"],
      bufferAfterMinutes: 0,
    },
    variants: [{ name: "Default", price: money(50000), unitKey: "SESSION" }],
  });
  expect(created.status).toBe(201);
  const offering = created.body.data as {
    offeringId: string;
    version: number;
    variants: { variantId: string }[];
  };
  const published = await actor.call(
    "post",
    offeringsPath(organizationId, `/${offering.offeringId}/publish`),
    { version: offering.version },
  );
  expect(published.status).toBe(200);
  return published.body.data as typeof offering;
}

export async function createStylistResource(
  actor: ApiActor,
  organizationId: string,
  input: {
    readonly locationId: string;
    readonly offeringId: string;
    readonly name: string;
    readonly capacity: number;
    readonly weeklySchedule: readonly { weekday: number; opensAt: string; closesAt: string }[];
    readonly resourceTypeKey?: string;
  },
): Promise<void> {
  const created = await actor.call("post", `/orgs/${organizationId}/resources`, {
    locationId: input.locationId,
    resourceTypeKey: input.resourceTypeKey ?? "STYLIST",
    name: input.name,
    capacity: input.capacity,
    weeklySchedule: input.weeklySchedule,
    offeringIds: [input.offeringId],
  });
  expect(created.status).toBe(201);
}

export const SUNDAY_SCHEDULE = [{ weekday: 7, opensAt: "09:00", closesAt: "18:00" }] as const;

export interface RentalPublishInput {
  readonly name?: string;
  readonly rateUnit?: "HOUR" | "DAY" | "NIGHT";
  readonly minUnits?: number;
  readonly maxUnits?: number;
  readonly resourceTypeKeys?: readonly string[];
  readonly checkInTime?: string;
  readonly checkOutTime?: string;
  readonly depositAmount?: { amount: number; currency: "BDT" };
  readonly unitPriceAmount?: number;
}

function buildRentalKindDetails(input: RentalPublishInput = {}) {
  const details: Record<string, unknown> = {
    rateUnit: input.rateUnit ?? "HOUR",
    minUnits: input.minUnits ?? 1,
    resourceTypeKeys: input.resourceTypeKeys ?? ["TABLE"],
  };
  if (input.maxUnits !== undefined) details["maxUnits"] = input.maxUnits;
  if (input.rateUnit === "NIGHT") {
    if (input.checkInTime) details["checkInTime"] = input.checkInTime;
    if (input.checkOutTime) details["checkOutTime"] = input.checkOutTime;
  }
  if (input.depositAmount) details["depositAmount"] = input.depositAmount;
  return details;
}

export async function publishBookableRental(
  actor: ApiActor,
  organizationId: string,
  input?: RentalPublishInput,
): Promise<{
  offeringId: string;
  version: number;
  variants: { variantId: string }[];
}> {
  const created = await actor.call("post", offeringsPath(organizationId), {
    kind: "RENTAL",
    name: input?.name ?? "Studio Rental",
    kindDetails: buildRentalKindDetails(input),
    variants: [
      { name: "Default", price: money(input?.unitPriceAmount ?? 100000), unitKey: "SESSION" },
    ],
  });
  expect(created.status).toBe(201);
  const offering = created.body.data as {
    offeringId: string;
    version: number;
    variants: { variantId: string }[];
  };
  const published = await actor.call(
    "post",
    offeringsPath(organizationId, `/${offering.offeringId}/publish`),
    { version: offering.version },
  );
  expect(published.status).toBe(200);
  return published.body.data as typeof offering;
}
