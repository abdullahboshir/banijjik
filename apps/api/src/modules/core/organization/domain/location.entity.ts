import {
  LOCATION_STATUS,
  LOCATION_TYPE,
  type LocationStatus,
  type LocationType,
  type PostalAddress,
} from "@banijjik/contracts";
import { newId, type LocationId, type OrganizationId, type UserId } from "@banijjik/ids";
import { applyClearableChange, type ClearableChange } from "./clearable.js";
import { invalidField, invalidTransition, locationIsDefault } from "./errors.js";

const NAME_MIN_LENGTH = 1;
const NAME_MAX_LENGTH = 80;

export interface LocationProps {
  readonly locationId: LocationId;
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly locationType: LocationType;
  readonly isDefault: boolean;
  readonly status: LocationStatus;
  readonly address: PostalAddress | undefined;
  readonly phoneE164: string | undefined;
  /** Missing means the organization's timezone. */
  readonly timezone: string | undefined;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Null when the system created it. */
  readonly createdByUserId: UserId | null;
}

export interface NewDefaultLocationInput {
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly district: string | undefined;
  /** Null when the system created it. */
  readonly createdByUserId: UserId | null;
  readonly now: Date;
}

export interface NewLocationInput {
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly locationType: LocationType;
  readonly address: PostalAddress | undefined;
  readonly phoneE164: string | undefined;
  readonly timezone: string | undefined;
  readonly createdByUserId: UserId;
  readonly now: Date;
}

/** The fields `PATCH /locations/{locationId}` may change. */
export interface LocationChanges {
  readonly name?: string | undefined;
  readonly locationType?: LocationType | undefined;
  /** `null` clears the field; an absent key leaves it. */
  readonly address?: ClearableChange<PostalAddress>;
  readonly phoneE164?: ClearableChange<string>;
  readonly timezone?: ClearableChange<string>;
}

function assertNameLength(name: string): void {
  if (name.length < NAME_MIN_LENGTH) throw invalidField("name", "validation.too_small");
  if (name.length > NAME_MAX_LENGTH) throw invalidField("name", "validation.too_big");
}

/** A physical or stock place of an organization (09 section 4.3). Every organization has one default. */
export class Location implements LocationProps {
  readonly locationId: LocationId;
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly locationType: LocationType;
  readonly isDefault: boolean;
  readonly status: LocationStatus;
  readonly address: PostalAddress | undefined;
  readonly phoneE164: string | undefined;
  readonly timezone: string | undefined;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Null when the system created it. */
  readonly createdByUserId: UserId | null;

  private constructor(props: LocationProps) {
    this.locationId = props.locationId;
    this.organizationId = props.organizationId;
    this.name = props.name;
    this.locationType = props.locationType;
    this.isDefault = props.isDefault;
    this.status = props.status;
    this.address = props.address;
    this.phoneE164 = props.phoneE164;
    this.timezone = props.timezone;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
  }

  /** The store every new organization starts with, named after the organization. */
  static createDefault(input: NewDefaultLocationInput): Location {
    const name = input.name.trim();
    assertNameLength(name);
    return new Location({
      locationId: newId(),
      organizationId: input.organizationId,
      name,
      locationType: LOCATION_TYPE.STORE,
      isDefault: true,
      status: LOCATION_STATUS.ACTIVE,
      address: input.district === undefined ? undefined : { district: input.district },
      phoneE164: undefined,
      timezone: undefined,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.createdByUserId,
    });
  }

  /** An additional, non-default location (09 section 4.3). */
  static create(input: NewLocationInput): Location {
    const name = input.name.trim();
    assertNameLength(name);
    return new Location({
      locationId: newId(),
      organizationId: input.organizationId,
      name,
      locationType: input.locationType,
      isDefault: false,
      status: LOCATION_STATUS.ACTIVE,
      address: input.address,
      phoneE164: input.phoneE164,
      timezone: input.timezone,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.createdByUserId,
    });
  }

  /** The location with the given changes applied; an archived location is read-only history. */
  withChanges(changes: LocationChanges): Location {
    this.assertActive();
    const name = changes.name === undefined ? this.name : changes.name.trim();
    assertNameLength(name);
    return new Location({
      ...this,
      name,
      locationType: changes.locationType ?? this.locationType,
      address: applyClearableChange(this.address, changes.address),
      phoneE164: applyClearableChange(this.phoneE164, changes.phoneE164),
      timezone: applyClearableChange(this.timezone, changes.timezone),
    });
  }

  /** The archived location. The default location can never be archived (09 section 4.3). */
  archive(): Location {
    this.assertActive();
    if (this.isDefault) throw locationIsDefault();
    return new Location({ ...this, status: LOCATION_STATUS.ARCHIVED });
  }

  /** Rebuilds a stored location. The stored data was checked when it was written. */
  static restore(props: LocationProps): Location {
    return new Location(props);
  }

  private assertActive(): void {
    if (!this.isActive()) throw invalidTransition(this.status);
  }

  isActive(): boolean {
    return this.status === LOCATION_STATUS.ACTIVE;
  }
}
