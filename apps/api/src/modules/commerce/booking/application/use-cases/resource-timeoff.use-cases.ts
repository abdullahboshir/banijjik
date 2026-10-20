import { AUDIT_ACTION } from "@banijjik/contracts";
import { BOOKING_EVENT_TYPE, RESOURCE_STATUS } from "@banijjik/contracts/booking";
import type { ResourceResponse } from "@banijjik/contracts/booking";
import { asId, newId, type ResourceId, type ResourceTimeOffId, type UserId } from "@banijjik/ids";
import type { ResourceTimeOffCreateBody } from "@banijjik/validation/booking";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { recordNotFound } from "../../domain/errors.js";
import { assertLocationAllowed } from "../resource-location-guard.js";
import { toResourceResponse, toResourceTimeOffResponse } from "../booking-views.js";
import type {
  BookingUnitOfWork,
  ResourceRepository,
  ResourceTimeOffRepository,
} from "../ports/booking-repositories.js";
import type { BookingEventPublisher } from "./create-booking.use-case.js";

export class ListResourceTimeOffUseCase {
  constructor(
    private readonly dependencies: {
      readonly resources: ResourceRepository;
      readonly timeOff: ResourceTimeOffRepository;
    },
  ) {}

  async execute(input: {
    readonly resourceId: ResourceId;
    readonly allowedLocationIds: readonly string[] | "ALL";
  }): Promise<ReturnType<typeof toResourceTimeOffResponse>[]> {
    const resource = await this.dependencies.resources.findById(input.resourceId);
    if (resource === undefined) throw recordNotFound();
    assertLocationAllowed(resource.locationId, input.allowedLocationIds);
    const rows = await this.dependencies.timeOff.listForResource(input.resourceId);
    return rows.map(toResourceTimeOffResponse);
  }
}

export class CreateResourceTimeOffUseCase {
  constructor(
    private readonly dependencies: {
      readonly resources: ResourceRepository;
      readonly timeOff: ResourceTimeOffRepository;
      readonly audit: AuditRecorder;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    readonly resourceId: ResourceId;
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly actorUserId: UserId | null;
    readonly body: ResourceTimeOffCreateBody;
  }): Promise<ReturnType<typeof toResourceTimeOffResponse>> {
    const resource = await this.dependencies.resources.findById(input.resourceId);
    if (resource === undefined) throw recordNotFound();
    assertLocationAllowed(resource.locationId, input.allowedLocationIds);
    const now = this.dependencies.clock.now();
    const startsAt = new Date(input.body.startsAt);
    const endsAt = new Date(input.body.endsAt);
    const record = {
      resourceTimeOffId: asId<ResourceTimeOffId>(newId()),
      organizationId: resource.organizationId,
      locationId: resource.locationId,
      resourceId: resource.resourceId,
      startsAt,
      endsAt,
      reason: input.body.reason ?? null,
      createdAt: now,
      updatedAt: now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    };
    await this.dependencies.timeOff.insert(record);
    await this.dependencies.audit.record({
      action: AUDIT_ACTION.RESOURCE_UPDATED,
      entityType: "resource",
      entityId: resource.resourceId,
      changes: {
        timeOff: {
          to: `${input.body.startsAt}/${input.body.endsAt}`,
        },
      },
    });
    return toResourceTimeOffResponse(record);
  }
}

export class ArchiveResourceUseCase {
  constructor(
    private readonly dependencies: {
      readonly resources: ResourceRepository;
      readonly unitOfWork: BookingUnitOfWork;
      readonly events: BookingEventPublisher;
      readonly audit: AuditRecorder;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    readonly resourceId: ResourceId;
    readonly version: number;
    readonly actorUserId: UserId | null;
    readonly allowedLocationIds: readonly string[] | "ALL";
  }): Promise<ResourceResponse> {
    const existing = await this.dependencies.resources.findById(input.resourceId);
    if (existing === undefined) throw recordNotFound();
    assertLocationAllowed(existing.locationId, input.allowedLocationIds);
    const archived = existing.applyChanges({
      status: RESOURCE_STATUS.INACTIVE,
      now: this.dependencies.clock.now(),
      actorUserId: input.actorUserId,
    });
    await this.dependencies.unitOfWork.run(async () => {
      await this.dependencies.resources.update(archived, input.version);
      await this.dependencies.events.publish(
        BOOKING_EVENT_TYPE.RESOURCE_DEACTIVATED,
        { resourceId: archived.resourceId },
        { orderingKey: `resource:${archived.resourceId}` },
      );
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.RESOURCE_ARCHIVED,
        entityType: "resource",
        entityId: archived.resourceId,
        changes: { status: { from: existing.status, to: RESOURCE_STATUS.INACTIVE } },
      });
    });
    return toResourceResponse(archived);
  }
}
