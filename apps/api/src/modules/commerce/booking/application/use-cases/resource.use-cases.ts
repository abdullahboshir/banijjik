import { AUDIT_ACTION } from "@banijjik/contracts";
import { BOOKING_EVENT_TYPE } from "@banijjik/contracts/booking";
import {
  asId,
  type LocationId,
  type MemberId,
  type OfferingId,
  type OrganizationId,
  type ResourceId,
  type UserId,
} from "@banijjik/ids";
import type { ResourceResponse } from "@banijjik/contracts/booking";
import type {
  ResourceCreateBody,
  ResourceListQuery,
  ResourceUpdateBody,
} from "@banijjik/validation/booking";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { Resource } from "../../domain/resource.entity.js";
import { bookingRuleError, recordNotFound } from "../../domain/errors.js";
import { assertLocationAllowed } from "../resource-location-guard.js";
import { memberIdAfterUpdate } from "../resource-update-member.js";
import { BOOKING_RULE_KEY } from "@banijjik/contracts/booking";
import { toResourceResponse } from "../booking-views.js";
import type { BookingUnitOfWork, ResourceRepository } from "../ports/booking-repositories.js";
import type { BookingEventPublisher } from "./create-booking.use-case.js";

export class CreateResourceUseCase {
  constructor(
    private readonly dependencies: {
      readonly resources: ResourceRepository;
      readonly unitOfWork: BookingUnitOfWork;
      readonly events: BookingEventPublisher;
      readonly audit: AuditRecorder;
      readonly clock: Clock;
      readonly resourceTypes: {
        listKeys(organizationId: OrganizationId): Promise<readonly string[]>;
      };
      readonly offerings: {
        assertActiveServiceOfferings(
          organizationId: OrganizationId,
          offeringIds: readonly OfferingId[],
        ): Promise<void>;
      };
      readonly members: {
        isAssignedToLocation(memberId: MemberId, locationId: LocationId): Promise<boolean>;
      };
    },
  ) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId | null;
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly body: ResourceCreateBody;
  }): Promise<ResourceResponse> {
    assertLocationAllowed(input.body.locationId, input.allowedLocationIds);
    const locationId = asId<LocationId>(input.body.locationId);
    const types = await this.dependencies.resourceTypes.listKeys(input.organizationId);
    if (!types.includes(input.body.resourceTypeKey)) {
      throw bookingRuleError(BOOKING_RULE_KEY.UNKNOWN_RESOURCE_TYPE);
    }
    const offeringIds = input.body.offeringIds.map((id) => asId<OfferingId>(id));
    await this.dependencies.offerings.assertActiveServiceOfferings(
      input.organizationId,
      offeringIds,
    );
    const memberId = input.body.memberId === undefined ? null : asId<MemberId>(input.body.memberId);
    if (memberId !== null) {
      const ok = await this.dependencies.members.isAssignedToLocation(memberId, locationId);
      if (!ok) throw bookingRuleError(BOOKING_RULE_KEY.INVALID_MEMBER_ASSIGNMENT);
    }
    const now = this.dependencies.clock.now();
    const resource = Resource.create({
      organizationId: input.organizationId,
      locationId,
      resourceTypeKey: input.body.resourceTypeKey,
      name: input.body.name,
      memberId,
      capacity: input.body.capacity,
      weeklySchedule: input.body.weeklySchedule,
      offeringIds,
      now,
      actorUserId: input.actorUserId,
    });
    await this.dependencies.unitOfWork.run(async () => {
      await this.dependencies.resources.insert(resource);
      await this.dependencies.events.publish(
        BOOKING_EVENT_TYPE.RESOURCE_CREATED,
        { resourceId: resource.resourceId },
        { orderingKey: `resource:${resource.resourceId}` },
      );
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.RESOURCE_CREATED,
        entityType: "resource",
        entityId: resource.resourceId,
        changes: { name: { to: resource.name } },
      });
    });
    return toResourceResponse(resource);
  }
}

export class ListResourcesUseCase {
  constructor(private readonly resources: ResourceRepository) {}

  async execute(
    query: ResourceListQuery,
  ): Promise<{ items: ResourceResponse[]; hasNext: boolean }> {
    const page = await this.resources.list({
      page: query.page,
      limit: query.limit,
      ...(query.locationId === undefined ? {} : { locationId: query.locationId }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.resourceTypeKey === undefined ? {} : { resourceTypeKey: query.resourceTypeKey }),
    });
    return {
      items: page.items.map(toResourceResponse),
      hasNext: page.hasNext,
    };
  }
}

export class GetResourceUseCase {
  constructor(private readonly resources: ResourceRepository) {}

  async execute(input: {
    readonly resourceId: ResourceId;
    readonly allowedLocationIds: readonly string[] | "ALL";
  }): Promise<ResourceResponse> {
    const resource = await this.resources.findById(input.resourceId);
    if (resource === undefined) throw recordNotFound();
    assertLocationAllowed(resource.locationId, input.allowedLocationIds);
    return toResourceResponse(resource);
  }
}

export class UpdateResourceUseCase {
  constructor(
    private readonly dependencies: {
      readonly resources: ResourceRepository;
      readonly unitOfWork: BookingUnitOfWork;
      readonly events: BookingEventPublisher;
      readonly audit: AuditRecorder;
      readonly clock: Clock;
      readonly offerings: {
        assertActiveServiceOfferings(
          organizationId: OrganizationId,
          offeringIds: readonly OfferingId[],
        ): Promise<void>;
      };
      readonly members: {
        isAssignedToLocation(memberId: MemberId, locationId: LocationId): Promise<boolean>;
      };
    },
  ) {}

  async execute(input: {
    readonly resourceId: ResourceId;
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly actorUserId: UserId | null;
    readonly body: ResourceUpdateBody;
  }): Promise<ResourceResponse> {
    const existing = await this.dependencies.resources.findById(input.resourceId);
    if (existing === undefined) throw recordNotFound();
    assertLocationAllowed(existing.locationId, input.allowedLocationIds);
    const offeringIds =
      input.body.offeringIds === undefined
        ? existing.offeringIds
        : input.body.offeringIds.map((id) => asId<OfferingId>(id));
    if (input.body.offeringIds !== undefined) {
      await this.dependencies.offerings.assertActiveServiceOfferings(
        existing.organizationId,
        offeringIds,
      );
    }
    const memberId = await memberIdAfterUpdate({
      existingMemberId: existing.memberId,
      bodyMemberId: input.body.memberId,
      locationId: existing.locationId,
      members: this.dependencies.members,
    });
    const now = this.dependencies.clock.now();
    const updated = existing.applyChanges({
      ...(input.body.name === undefined ? {} : { name: input.body.name }),
      memberId,
      ...(input.body.capacity === undefined ? {} : { capacity: input.body.capacity }),
      ...(input.body.weeklySchedule === undefined
        ? {}
        : { weeklySchedule: input.body.weeklySchedule }),
      ...(input.body.offeringIds === undefined ? {} : { offeringIds }),
      ...(input.body.status === undefined ? {} : { status: input.body.status }),
      now,
      actorUserId: input.actorUserId,
    });
    await this.dependencies.unitOfWork.run(async () => {
      await this.dependencies.resources.update(updated, input.body.version);
      await this.dependencies.events.publish(
        BOOKING_EVENT_TYPE.RESOURCE_UPDATED,
        { resourceId: updated.resourceId },
        { orderingKey: `resource:${updated.resourceId}` },
      );
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.RESOURCE_UPDATED,
        entityType: "resource",
        entityId: updated.resourceId,
        changes: { name: { from: existing.name, to: updated.name } },
      });
    });
    return toResourceResponse(updated);
  }
}

export {
  ArchiveResourceUseCase,
  CreateResourceTimeOffUseCase,
  ListResourceTimeOffUseCase,
} from "./resource-timeoff.use-cases.js";

export type { ResourceUpdateBody };
