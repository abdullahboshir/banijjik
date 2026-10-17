import type { EffectiveCustomField } from "@banijjik/contracts";
import type { Member } from "../domain/member.entity.js";
import type { Organization } from "../domain/organization.entity.js";
import { readableCustomFields } from "./custom-field-values.js";
import type { SensitiveValueAccess } from "./ports/custom-field-ports.js";

/** The business profile with the custom field values the caller may read (ADR-107). */
export interface ProfileView {
  readonly organization: Organization;
  readonly customFields: Record<string, unknown>;
}

/** A member with the custom field values the caller may read (ADR-107). */
export interface MemberDetailView {
  readonly member: Member;
  readonly customFields: Record<string, unknown>;
}

export async function viewOrganization(
  access: SensitiveValueAccess,
  organization: Organization,
  fields: readonly EffectiveCustomField[],
): Promise<ProfileView> {
  const canReadSensitive = await access.mayReadOrganizationSensitive();
  return {
    organization,
    customFields: readableCustomFields({
      stored: organization.customFields,
      fields,
      canReadSensitive,
    }),
  };
}

export async function viewMember(
  access: SensitiveValueAccess,
  member: Member,
  fields: readonly EffectiveCustomField[],
): Promise<MemberDetailView> {
  const canReadSensitive = await access.mayReadMemberSensitive();
  return {
    member,
    customFields: readableCustomFields({ stored: member.customFields, fields, canReadSensitive }),
  };
}
