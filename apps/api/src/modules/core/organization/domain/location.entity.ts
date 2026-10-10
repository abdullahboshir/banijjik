import {
  LOCATION_STATUS,
  LOCATION_TYPE,
  type LocationStatus,
  type LocationType,
  type PostalAddress,
} from "@banijjik/contracts";
import { newId, type LocationId, type OrganizationId, type UserId } from "@banijjik/ids";
import { invalidField } from "./errors.js";

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

  /** Rebuilds a stored location. The stored data was checked when it was written. */
  static restore(props: LocationProps): Location {
    return new Location(props);
  }

  isActive(): boolean {
    return this.status === LOCATION_STATUS.ACTIVE;
  }
}
