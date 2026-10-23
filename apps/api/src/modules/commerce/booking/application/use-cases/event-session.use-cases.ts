import {
  asId,
  type EventSessionId,
  type LocationId,
  type OfferingId,
  type OrganizationId,
  type ResourceId,
  type UserId,
} from "@banijjik/ids";
import { BOOKING_RULE_KEY } from "@banijjik/contracts/booking";
import type {
  EventSessionCreateBody,
  EventSessionListQuery,
  EventSessionUpdateBody,
} from "@banijjik/validation/booking";
import type { Clock } from "../../../../../kernel/time/index.js";
import { EventSession } from "../../domain/event-session.entity.js";
import { bookingRuleError, recordNotFound } from "../../domain/errors.js";
import { assertLocationAllowed } from "../resource-location-guard.js";
import type { EventSessionOfferingReader } from "../ports/event-session-offering-reader.js";
import type { EventSessionRepository } from "../ports/event-session-repository.js";

import type { ResourceRepository } from "../ports/booking-repositories.js";

type Caller = {
  organizationId: OrganizationId;
  actorUserId: UserId;
  allowedLocationIds: readonly string[] | "ALL";
};
export class EventSessionUseCases {
  constructor(
    private readonly dependencies: {
      sessions: EventSessionRepository;
      resources: Pick<ResourceRepository, "findById">;
      offerings: EventSessionOfferingReader;
      clock: Clock;
    },
  ) {}
  async create(input: Caller & { body: EventSessionCreateBody }): Promise<EventSession> {
    const { body } = input;
    assertLocationAllowed(body.locationId, input.allowedLocationIds);
    const locationId = asId<LocationId>(body.locationId);
    const offeringId = asId<OfferingId>(body.offeringId);
    const offering = await this.dependencies.offerings.readEventOffering({
      organizationId: input.organizationId,
      offeringId,
      locationId,
      variantId: body.variantId,
    });
    if (offering === undefined) throw bookingRuleError(BOOKING_RULE_KEY.OFFERING_NOT_BOOKABLE);
    for (const resourceId of body.resourceIds) {
      const resource = await this.dependencies.resources.findById(asId<ResourceId>(resourceId));
      if (resource === undefined || resource.locationId !== locationId) {
        throw bookingRuleError(BOOKING_RULE_KEY.RESOURCE_WRONG_LOCATION);
      }
    }
    const session = EventSession.create({
      organizationId: input.organizationId,
      offeringId,
      locationId,
      variantId: body.variantId,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
      capacity: body.capacity,
      resourceIds: body.resourceIds.map((value) => asId<ResourceId>(value)),
      now: this.dependencies.clock.now(),
      actorUserId: input.actorUserId,
    });
    await this.dependencies.sessions.insert(session);
    return session;
  }
  async get(
    eventSessionId: EventSessionId,
    allowedLocationIds: readonly string[] | "ALL",
  ): Promise<EventSession> {
    const session = await this.dependencies.sessions.findById(eventSessionId);
    if (session === undefined) throw recordNotFound();
    assertLocationAllowed(session.toProps().locationId, allowedLocationIds);
    return session;
  }
  async list(
    query: EventSessionListQuery,
    allowedLocationIds: readonly string[] | "ALL",
  ): Promise<{ items: EventSession[]; hasNext: boolean }> {
    if (query.locationId !== undefined) assertLocationAllowed(query.locationId, allowedLocationIds);
    return this.dependencies.sessions.list(query, allowedLocationIds);
  }
  async update(
    input: Caller & { eventSessionId: EventSessionId; body: EventSessionUpdateBody },
  ): Promise<EventSession> {
    const existing = await this.get(input.eventSessionId, input.allowedLocationIds);
    const updated = existing.update({
      ...(input.body.startsAt === undefined ? {} : { startsAt: new Date(input.body.startsAt) }),
      ...(input.body.endsAt === undefined ? {} : { endsAt: new Date(input.body.endsAt) }),
      ...(input.body.capacity === undefined ? {} : { capacity: input.body.capacity }),
      now: this.dependencies.clock.now(),
      actorUserId: input.actorUserId,
    });
    return this.dependencies.sessions.update(updated, input.body.version, existing);
  }
  async cancel(
    input: Caller & { eventSessionId: EventSessionId; version: number },
  ): Promise<EventSession> {
    const existing = await this.get(input.eventSessionId, input.allowedLocationIds);
    const cancelled = existing.cancel(this.dependencies.clock.now(), input.actorUserId);
    return this.dependencies.sessions.update(cancelled, input.version, existing);
  }
}
