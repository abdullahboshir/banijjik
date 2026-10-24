import {
  asId,
  type EventSessionId,
  type LocationId,
  type OfferingId,
  type OrganizationId,
  type ResourceId,
  type UserId,
} from "@banijjik/ids";
import { BOOKING_EVENT_TYPE, BOOKING_RULE_KEY } from "@banijjik/contracts/booking";
import { AUDIT_ACTION, OFFERING_KIND } from "@banijjik/contracts";
import type {
  EventSessionCreateBody,
  EventSessionListQuery,
  EventSessionUpdateBody,
} from "@banijjik/validation/booking";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { EventSession } from "../../domain/event-session.entity.js";
import {
  bookingRuleError,
  eventSessionResourceBusyError,
  recordNotFound,
} from "../../domain/errors.js";
import {
  takeSessionResourceHolds,
  releaseSessionResourceHolds,
} from "../event-session-resource-holds.js";
import type {
  ResourceSlotUsagePort,
  ResourceTimeOffRepository,
} from "../ports/booking-repositories.js";
import { conflict } from "../../../../../kernel/http/index.js";
import { runWithTxnRetry } from "../run-with-txn-retry.js";
import { assertLocationAllowed } from "../resource-location-guard.js";
import type { BookingOfferingReader } from "../ports/booking-context-ports.js";
import type { EventSessionRepository } from "../ports/event-session-repository.js";

import type { BookingUnitOfWork, ResourceRepository } from "../ports/booking-repositories.js";
import type { BookingEventPublisher } from "./create-booking.use-case.js";

type Caller = {
  organizationId: OrganizationId;
  actorUserId: UserId;
  allowedLocationIds: readonly string[] | "ALL";
};

/** A session can only hold seats for an active EVENT offering that sells at its location. */
async function loadBookableEventOffering(
  offerings: BookingOfferingReader,
  input: {
    organizationId: OrganizationId;
    offeringId: OfferingId;
    variantId: string;
    locationId: LocationId;
  },
): Promise<void> {
  const offering = await offerings.readOffering(input);
  if (offering === undefined || offering.kind !== OFFERING_KIND.EVENT || !offering.isActive) {
    throw bookingRuleError(BOOKING_RULE_KEY.OFFERING_NOT_BOOKABLE);
  }
}

export class EventSessionUseCases {
  constructor(
    private readonly dependencies: {
      sessions: EventSessionRepository;
      resources: Pick<ResourceRepository, "findById">;
      slots: Pick<ResourceSlotUsagePort, "takeWholeResource" | "releaseWholeResource">;
      timeOff: Pick<ResourceTimeOffRepository, "listOverlapping">;
      offerings: BookingOfferingReader;
      unitOfWork: BookingUnitOfWork;
      events: BookingEventPublisher;
      audit: AuditRecorder;
      clock: Clock;
    },
  ) {}
  async create(input: Caller & { body: EventSessionCreateBody }): Promise<EventSession> {
    const { body } = input;
    assertLocationAllowed(body.locationId, input.allowedLocationIds);
    const locationId = asId<LocationId>(body.locationId);
    const offeringId = asId<OfferingId>(body.offeringId);
    await loadBookableEventOffering(this.dependencies.offerings, {
      organizationId: input.organizationId,
      offeringId,
      locationId,
      variantId: body.variantId,
    });
    let session!: EventSession;
    await runWithTxnRetry(
      this.dependencies.unitOfWork,
      async () => {
        const startsAt = new Date(body.startsAt);
        const endsAt = new Date(body.endsAt);
        const resourceIds = body.resourceIds.map((value) => asId<ResourceId>(value));
        const holds = await takeSessionResourceHolds({
          ...this.dependencies,
          organizationId: input.organizationId,
          locationId,
          resourceIds,
          startsAt,
          endsAt,
        });
        session = EventSession.create({
          organizationId: input.organizationId,
          offeringId,
          locationId,
          variantId: body.variantId,
          startsAt,
          endsAt,
          capacity: body.capacity,
          resourceIds,
          resourceHolds: holds,
          now: this.dependencies.clock.now(),
          actorUserId: input.actorUserId,
        });
        await this.dependencies.sessions.insert(session);
      },
      eventSessionResourceBusyError,
    );
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
    // A stale request must fail before any counter moves (the write below checks it again).
    if (existing.toProps().version !== input.body.version)
      throw conflict({ currentVersion: existing.toProps().version });
    const timeChanged = input.body.startsAt !== undefined || input.body.endsAt !== undefined;
    const changed = existing.update({
      ...(input.body.startsAt === undefined ? {} : { startsAt: new Date(input.body.startsAt) }),
      ...(input.body.endsAt === undefined ? {} : { endsAt: new Date(input.body.endsAt) }),
      ...(input.body.capacity === undefined ? {} : { capacity: input.body.capacity }),
      now: this.dependencies.clock.now(),
      actorUserId: input.actorUserId,
    });
    if (!timeChanged)
      return this.dependencies.unitOfWork.run(() =>
        this.dependencies.sessions.update(changed, input.body.version, existing),
      );
    let persisted = changed;
    await runWithTxnRetry(
      this.dependencies.unitOfWork,
      async () => {
        persisted = await this.moveSession(input, existing, changed);
      },
      eventSessionResourceBusyError,
    );
    return persisted;
  }
  /** Frees the old window, takes the new one and writes the session once, all in the open transaction. */
  private async moveSession(
    input: Caller & { body: EventSessionUpdateBody },
    existing: EventSession,
    changed: EventSession,
  ): Promise<EventSession> {
    const before = existing.toProps();
    const after = changed.toProps();
    await releaseSessionResourceHolds({
      slots: this.dependencies.slots,
      organizationId: before.organizationId,
      holds: before.resourceHolds,
      startsAt: before.startsAt,
      endsAt: before.endsAt,
    });
    const holds = await takeSessionResourceHolds({
      ...this.dependencies,
      organizationId: before.organizationId,
      locationId: before.locationId,
      resourceIds: before.resourceIds,
      startsAt: after.startsAt,
      endsAt: after.endsAt,
    });
    const withHolds = changed.update({
      resourceHolds: holds,
      now: this.dependencies.clock.now(),
      actorUserId: input.actorUserId,
    });
    return this.dependencies.sessions.update(withHolds, input.body.version, existing);
  }
  async cancel(
    input: Caller & { eventSessionId: EventSessionId; version: number },
  ): Promise<EventSession> {
    const existing = await this.get(input.eventSessionId, input.allowedLocationIds);
    const cancelled = existing.cancel(this.dependencies.clock.now(), input.actorUserId);
    let persisted = cancelled;
    await this.dependencies.unitOfWork.run(async () => {
      persisted = await this.dependencies.sessions.update(cancelled, input.version, existing);
      await releaseSessionResourceHolds({
        slots: this.dependencies.slots,
        organizationId: input.organizationId,
        holds: existing.toProps().resourceHolds,
        startsAt: existing.toProps().startsAt,
        endsAt: existing.toProps().endsAt,
      });
      await this.dependencies.events.publish(
        BOOKING_EVENT_TYPE.EVENT_SESSION_CANCELLED,
        { eventSessionId: input.eventSessionId },
        { orderingKey: `eventSession:${input.eventSessionId}` },
      );
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.EVENT_SESSION_CANCELLED,
        entityType: "eventSession",
        entityId: input.eventSessionId,
        changes: { status: { from: existing.toProps().status, to: cancelled.toProps().status } },
      });
    });
    return persisted;
  }
}
