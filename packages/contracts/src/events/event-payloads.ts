import { CUSTOM_FIELD_EVENT_TYPE } from "../custom-field/custom-field-event-type.js";
import type { CustomFieldDefinitionChangedPayload } from "../custom-field/custom-field-contracts.js";
import { IAM_EVENT_TYPE } from "../iam/iam-event-type.js";
import { ORGANIZATION_EVENT_TYPE } from "../organization/organization-event-type.js";
import { SETTINGS_EVENT_TYPE } from "../settings/settings-event-type.js";
import type { SettingChangedPayload } from "../settings/settings-contracts.js";

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

export interface OrganizationRenamedPayload {
  readonly organizationId: string;
}

/** An organization changed its status (suspended or reactivated); the reason stays in the platform audit log. */
export interface OrganizationStatusPayload {
  readonly organizationId: string;
}

/** Ids only: the invitation token and the invitee's phone or email never travel in an event. */
export interface InvitationPayload {
  readonly invitationId: string;
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
  readonly [ORGANIZATION_EVENT_TYPE.ORGANIZATION_RENAMED]: OrganizationRenamedPayload;
  readonly [ORGANIZATION_EVENT_TYPE.LOCATION_UPDATED]: LocationCreatedPayload;
  readonly [ORGANIZATION_EVENT_TYPE.LOCATION_ARCHIVED]: LocationCreatedPayload;
  readonly [ORGANIZATION_EVENT_TYPE.MEMBER_INVITED]: InvitationPayload;
  readonly [ORGANIZATION_EVENT_TYPE.MEMBER_ASSIGNMENTS_CHANGED]: MemberJoinedPayload;
  readonly [ORGANIZATION_EVENT_TYPE.MEMBER_SUSPENDED]: MemberJoinedPayload;
  readonly [ORGANIZATION_EVENT_TYPE.MEMBER_REACTIVATED]: MemberJoinedPayload;
  readonly [ORGANIZATION_EVENT_TYPE.MEMBER_REMOVED]: MemberJoinedPayload;
  readonly [ORGANIZATION_EVENT_TYPE.INVITATION_REVOKED]: InvitationPayload;
  readonly [ORGANIZATION_EVENT_TYPE.ORGANIZATION_SUSPENDED]: OrganizationStatusPayload;
  readonly [ORGANIZATION_EVENT_TYPE.ORGANIZATION_REACTIVATED]: OrganizationStatusPayload;
  readonly [ORGANIZATION_EVENT_TYPE.INDUSTRY_TEMPLATE_CHANGED]: OrganizationStatusPayload;
  readonly [CUSTOM_FIELD_EVENT_TYPE.DEFINITION_CHANGED]: CustomFieldDefinitionChangedPayload;
  readonly [SETTINGS_EVENT_TYPE.SETTING_CHANGED]: SettingChangedPayload;
}
