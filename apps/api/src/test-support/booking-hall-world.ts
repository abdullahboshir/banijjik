import {
  asId,
  newId,
  type LocationId,
  type OrganizationId,
  type ResourceId,
  type ResourceTimeOffId,
} from "@banijjik/ids";
import { expect } from "vitest";
import { MongoResourceTimeOffRepository } from "../modules/commerce/booking/infrastructure/mongo-resource-timeoff.repository.js";
import { runInOrganizationContext } from "../kernel/tenancy/index.js";
import {
  publishBookableEvent,
  publishBookableRental,
  publishBookableService,
  SUNDAY_SCHEDULE,
} from "./booking-api-world.js";
import { worldFor } from "./catalog-world.js";
import type { IamApiHarness } from "./iam-api-harness.js";
import type { Response } from "supertest";
import type { ApiActor, TwoOrganizations } from "./two-organizations.js";

/**
 * Each template sells one of the three offering kinds, so the world switches the organization
 * between them. Lint keeps template keys in test files: the test names them.
 */
export interface HallTemplates {
  readonly created: object;
  readonly event: object;
  readonly rental: object;
  readonly service: object;
}

export const SESSION_STARTS_AT = "2026-11-01T04:00:00.000Z";
export const SESSION_ENDS_AT = "2026-11-01T05:00:00.000Z";
/** One hour is twelve five-minute counter buckets. */
export const BUCKETS_PER_HOUR = 12;

type Offering = Awaited<ReturnType<typeof publishBookableEvent>>;

export interface HallWorld {
  readonly harness: IamApiHarness;
  readonly world: TwoOrganizations;
  readonly event: Offering;
  readonly rental: Offering;
  readonly service: Offering;
  readonly contactId: string;
  readonly resourceId: string;
  readonly sessionsPath: string;
}

async function switchTemplate(
  harness: IamApiHarness,
  organizationId: string,
  template: object,
): Promise<void> {
  await harness.connections.platform
    .collection("organizations")
    .updateOne({ organizationId }, { $set: template, $inc: { configVersion: 1 } });
}

export async function createHall(
  harness: IamApiHarness,
  actor: ApiActor,
  input: {
    readonly organizationId: string;
    readonly locationId: string;
    readonly offeringIds: readonly string[];
    readonly capacity: number;
    readonly name?: string;
  },
): Promise<string> {
  const created = await actor.call("post", `/orgs/${input.organizationId}/resources`, {
    locationId: input.locationId,
    resourceTypeKey: "STYLIST",
    name: input.name ?? "Hall",
    capacity: input.capacity,
    weeklySchedule: SUNDAY_SCHEDULE,
    offeringIds: input.offeringIds,
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return (created.body.data as { resourceId: string }).resourceId;
}

/**
 * Organization A with an EVENT offering, a RENTAL offering and a SERVICE offering, and one hall
 * (a STYLIST-type resource, so the service can use it too) that rentals and services book.
 */
export async function hallWorld(
  harness: IamApiHarness,
  hallCapacity: number,
  templates: HallTemplates,
): Promise<HallWorld> {
  const world = await worldFor(harness, templates.created, templates.event);
  const event = await publishBookableEvent(world.alice, world.organizationA);
  await switchTemplate(harness, world.organizationA, templates.rental);
  const rental = await publishBookableRental(world.alice, world.organizationA, {
    name: "Hall rental",
    rateUnit: "HOUR",
    minUnits: 1,
    maxUnits: 12,
    resourceTypeKeys: ["STYLIST"],
  });
  const contact = await world.alice.call("post", `/orgs/${world.organizationA}/contacts`, {
    contactType: "PERSON",
    name: "Hall customer",
    phoneE164: "+8801710000002",
    contactRoles: ["CUSTOMER"],
  });
  expect(contact.status, JSON.stringify(contact.body)).toBe(201);
  await switchTemplate(harness, world.organizationA, templates.service);
  const service = await publishBookableService(world.alice, world.organizationA);
  const resourceId = await createHall(harness, world.alice, {
    organizationId: world.organizationA,
    locationId: world.locationA1,
    offeringIds: [rental.offeringId, service.offeringId],
    capacity: hallCapacity,
  });
  return {
    harness,
    world,
    event,
    rental,
    service,
    contactId: (contact.body.data as { contactId: string }).contactId,
    resourceId,
    sessionsPath: `/orgs/${world.organizationA}/event-sessions`,
  };
}

export function sessionBody(
  hall: HallWorld,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    offeringId: hall.event.offeringId,
    variantId: hall.event.variants[0]?.variantId,
    locationId: hall.world.locationA1,
    startsAt: SESSION_STARTS_AT,
    endsAt: SESSION_ENDS_AT,
    capacity: 10,
    resourceIds: [hall.resourceId],
    ...extra,
  };
}

export function createSession(
  hall: HallWorld,
  extra: Record<string, unknown> = {},
): Promise<Response> {
  return hall.world.alice.call("post", hall.sessionsPath, sessionBody(hall, extra));
}

/** A one-hour rental booking of the hall. */
export function createRental(hall: HallWorld, startsAt = SESSION_STARTS_AT): Promise<Response> {
  return hall.world.alice.call("post", `/orgs/${hall.world.organizationA}/bookings`, {
    offeringId: hall.rental.offeringId,
    variantId: hall.rental.variants[0]?.variantId,
    locationId: hall.world.locationA1,
    startsAt,
    quantity: 1,
    contactId: hall.contactId,
  });
}

/** The `used` value of every counter bucket written for a resource, keyed by bucket start. */
export async function usedByBucket(
  harness: IamApiHarness,
  resourceId: string,
): Promise<Record<string, number>> {
  const rows = await harness.connections.tenantShared
    .collection("resource_slot_usages")
    .find({ resourceId })
    .toArray();
  return Object.fromEntries(
    rows.map((row) => [(row["bucketStart"] as Date).toISOString(), row["used"] as number]),
  );
}

export function usedValues(buckets: Record<string, number>): number[] {
  return Object.values(buckets);
}

/**
 * A time-off row written through the repository. The time-off endpoint cannot be used here: it
 * records its audit entry outside a transaction and answers 500 (reported in the 3.33 handoff).
 */
export async function insertTimeOff(
  hall: HallWorld,
  window: { readonly startsAt: string; readonly endsAt: string },
): Promise<void> {
  const now = new Date();
  await runInOrganizationContext(hall.world.organizationA, () =>
    new MongoResourceTimeOffRepository().insert({
      resourceTimeOffId: asId<ResourceTimeOffId>(newId()),
      organizationId: asId<OrganizationId>(hall.world.organizationA),
      locationId: asId<LocationId>(hall.world.locationA1),
      resourceId: asId<ResourceId>(hall.resourceId),
      startsAt: new Date(window.startsAt),
      endsAt: new Date(window.endsAt),
      reason: "maintenance",
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      updatedByUserId: null,
    }),
  );
}
