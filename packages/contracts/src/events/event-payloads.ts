import { IAM_EVENT_TYPE } from "../iam/iam-event-type.js";
import { ORGANIZATION_EVENT_TYPE } from "../organization/organization-event-type.js";

/** Payloads carry identifiers only, never personal data: a consumer reads the rest through the owning module. */
export interface UserRegisteredPayload {
  readonly userId: string;
}

export interface RolePayload {
  readonly roleId: string;
}

export interface OrganizationCreatedPayload {
  readonly organizationId: string;
  readonly organizationSlug: string;
}

export interface LocationCreatedPayload {
  readonly locationId: string;
}

export interface MemberJoinedPayload {
  readonly memberId: string;
  readonly userId: string;
}

/** The payload of each event type. `publishEvent` takes its payload type from this map. */
export interface EventPayloadMap {
  readonly [IAM_EVENT_TYPE.USER_REGISTERED]: UserRegisteredPayload;
  readonly [IAM_EVENT_TYPE.ROLE_CREATED]: RolePayload;
  readonly [IAM_EVENT_TYPE.ROLE_PERMISSIONS_CHANGED]: RolePayload;
  readonly [IAM_EVENT_TYPE.ROLE_ARCHIVED]: RolePayload;
  readonly [ORGANIZATION_EVENT_TYPE.ORGANIZATION_CREATED]: OrganizationCreatedPayload;
  readonly [ORGANIZATION_EVENT_TYPE.LOCATION_CREATED]: LocationCreatedPayload;
  readonly [ORGANIZATION_EVENT_TYPE.MEMBER_JOINED]: MemberJoinedPayload;
}
