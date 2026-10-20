import {
  RESOURCE_STATUS,
  type ResourceStatus,
  type ScheduleRange,
} from "@banijjik/contracts/booking";
import {
  asId,
  newId,
  type LocationId,
  type MemberId,
  type OfferingId,
  type OrganizationId,
  type ResourceId,
  type UserId,
} from "@banijjik/ids";
import { assertScheduleValid } from "./schedule.js";

export interface ResourceProps {
  readonly resourceId: ResourceId;
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly resourceTypeKey: string;
  readonly name: string;
  readonly memberId: MemberId | null;
  readonly capacity: number;
  readonly weeklySchedule: readonly ScheduleRange[];
  readonly offeringIds: readonly OfferingId[];
  readonly status: ResourceStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export class Resource {
  private constructor(private readonly props: ResourceProps) {}

  static create(input: {
    readonly organizationId: OrganizationId;
    readonly locationId: LocationId;
    readonly resourceTypeKey: string;
    readonly name: string;
    readonly memberId: MemberId | null;
    readonly capacity: number;
    readonly weeklySchedule: readonly ScheduleRange[];
    readonly offeringIds: readonly OfferingId[];
    readonly now: Date;
    readonly actorUserId: UserId | null;
  }): Resource {
    assertScheduleValid(input.weeklySchedule);
    return new Resource({
      resourceId: asId<ResourceId>(newId()),
      organizationId: input.organizationId,
      locationId: input.locationId,
      resourceTypeKey: input.resourceTypeKey,
      name: input.name,
      memberId: input.memberId,
      capacity: input.capacity,
      weeklySchedule: input.weeklySchedule,
      offeringIds: input.offeringIds,
      status: RESOURCE_STATUS.ACTIVE,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }

  static rehydrate(props: ResourceProps): Resource {
    return new Resource(props);
  }

  get resourceId(): ResourceId {
    return this.props.resourceId;
  }

  get organizationId(): OrganizationId {
    return this.props.organizationId;
  }

  get locationId(): LocationId {
    return this.props.locationId;
  }

  get resourceTypeKey(): string {
    return this.props.resourceTypeKey;
  }

  get name(): string {
    return this.props.name;
  }

  get memberId(): MemberId | null {
    return this.props.memberId;
  }

  get capacity(): number {
    return this.props.capacity;
  }

  get weeklySchedule(): readonly ScheduleRange[] {
    return this.props.weeklySchedule;
  }

  get offeringIds(): readonly OfferingId[] {
    return this.props.offeringIds;
  }

  get status(): ResourceStatus {
    return this.props.status;
  }

  get version(): number {
    return this.props.version;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get createdByUserId(): UserId | null {
    return this.props.createdByUserId;
  }

  get updatedByUserId(): UserId | null {
    return this.props.updatedByUserId;
  }

  applyChanges(input: {
    readonly name?: string;
    readonly memberId?: MemberId | null;
    readonly capacity?: number;
    readonly weeklySchedule?: readonly ScheduleRange[];
    readonly offeringIds?: readonly OfferingId[];
    readonly status?: ResourceStatus;
    readonly now: Date;
    readonly actorUserId: UserId | null;
  }): Resource {
    const weeklySchedule = input.weeklySchedule ?? this.props.weeklySchedule;
    assertScheduleValid(weeklySchedule);
    return new Resource({
      ...this.props,
      name: input.name ?? this.props.name,
      memberId: input.memberId === undefined ? this.props.memberId : input.memberId,
      capacity: input.capacity ?? this.props.capacity,
      weeklySchedule,
      offeringIds: input.offeringIds ?? this.props.offeringIds,
      status: input.status ?? this.props.status,
      updatedAt: input.now,
      updatedByUserId: input.actorUserId,
    });
  }

  toProps(): ResourceProps {
    return this.props;
  }
}
