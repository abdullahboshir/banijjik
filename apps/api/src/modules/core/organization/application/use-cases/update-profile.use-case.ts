import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  ORGANIZATION_EVENT_TYPE,
  type PreferredLocale,
  type OrganizationProfileFields,
} from "@banijjik/contracts";
import type { OrganizationId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { ClearableChanges } from "../../domain/clearable.js";
import { recordNotFound } from "../../domain/errors.js";
import type { Organization, OrganizationBranding } from "../../domain/organization.entity.js";
import { diffAuditFields, type AuditFields } from "../../../../../kernel/audit/index.js";
import { assertBrandingAllowed } from "../branding-check.js";
import { viewOrganization, type ProfileView } from "../custom-field-view.js";
import { assertFileValuesUsable } from "../custom-field-file-values.js";
import { mergeCustomFieldValues, type MergedCustomFields } from "../custom-field-values.js";
import type {
  FileReferenceChecker,
  OrganizationCustomFieldReader,
  SensitiveValueAccess,
} from "../ports/custom-field-ports.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type { OrganizationProfileRepository } from "../ports/organization-profile-repository.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export interface UpdateProfileInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly version: number;
  readonly name?: string;
  readonly defaultLocale?: PreferredLocale;
  /** Per optional field: a value sets it, `null` clears it, an absent key leaves it. */
  readonly profile?: ClearableChanges<OrganizationProfileFields>;
  /** Per key: a value sets it, `null` clears it, an absent key leaves it. Validated against the organization fields. */
  readonly customFields?: Readonly<Record<string, unknown>>;
  /** Per key: a value sets it, `null` clears it, an absent key leaves it. Colours and the logo are checked here (ADR-114). */
  readonly branding?: ClearableChanges<OrganizationBranding>;
}

export interface UpdateProfileDependencies {
  readonly organizations: OrganizationProfileRepository;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly audit: AuditRecorder;
  readonly customFields: OrganizationCustomFieldReader;
  readonly sensitiveAccess: SensitiveValueAccess;
  readonly fileReferences: FileReferenceChecker;
}

function auditFieldsOf(organization: Organization): AuditFields {
  const { profile } = organization;
  return {
    name: organization.name,
    defaultLocale: organization.defaultLocale,
    "profile.legalName": profile.legalName,
    "profile.legalType": profile.legalType,
    "profile.phoneE164": profile.phoneE164,
    "profile.email": profile.email,
    "profile.tradeLicenseNumber": profile.tradeLicenseNumber,
    "profile.address.line1": profile.address?.line1,
    "profile.address.area": profile.address?.area,
    "profile.address.thana": profile.address?.thana,
    "profile.address.district": profile.address?.district,
    "profile.address.postalCode": profile.address?.postalCode,
    "branding.logoFileId": organization.branding.logoFileId,
    "branding.primaryColor": organization.branding.primaryColor,
    "branding.accentColor": organization.branding.accentColor,
    "branding.tagline": organization.branding.tagline,
  };
}

/**
 * Edits the name, the default language, the profile and the custom field values. The slug,
 * currency, timezone, country and industry template are not editable here. A stale version is a
 * 409; the audit entry and the events are written in the same transaction as the change.
 */
export class UpdateProfileUseCase {
  constructor(private readonly dependencies: UpdateProfileDependencies) {}

  async execute(input: UpdateProfileInput): Promise<ProfileView> {
    const { organizations, unitOfWork, customFields, sensitiveAccess, fileReferences } =
      this.dependencies;
    const existing = await organizations.findById(input.organizationId);
    if (existing === undefined) throw recordNotFound();
    if (input.branding !== undefined) {
      await assertBrandingAllowed({ changes: input.branding, fileReferences });
    }
    const fields = await customFields.forEntity(input.organizationId, "organization");
    if (input.customFields !== undefined) {
      await assertFileValuesUsable({
        checker: fileReferences,
        fields,
        requested: input.customFields,
      });
    }
    const merged =
      input.customFields === undefined
        ? undefined
        : mergeCustomFieldValues({
            stored: existing.customFields,
            requested: input.customFields,
            fields,
            canWriteSensitive: await sensitiveAccess.mayReadOrganizationSensitive(),
          });
    const edited = existing.withProfileChanges({
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.defaultLocale === undefined ? {} : { defaultLocale: input.defaultLocale }),
      ...(input.profile === undefined ? {} : { profile: input.profile }),
      ...(merged === undefined ? {} : { customFields: merged }),
      ...(input.branding === undefined ? {} : { branding: input.branding }),
    });
    const saved = await unitOfWork.run(async () => {
      const updated = await organizations.update(edited, input.version, input.actorUserId);
      await this.record(existing, updated, merged);
      return updated;
    });
    return viewOrganization(sensitiveAccess, saved, fields);
  }

  private async record(
    before: Organization,
    after: Organization,
    merged: MergedCustomFields | undefined,
  ): Promise<void> {
    const { audit, events } = this.dependencies;
    await audit.record({
      action: AUDIT_ACTION.ORGANIZATION_UPDATED,
      entityType: AUDIT_ENTITY_TYPE.organization,
      entityId: after.organizationId,
      changes: {
        ...diffAuditFields(auditFieldsOf(before), auditFieldsOf(after)),
        ...merged?.auditChanges,
      },
    });
    if (before.name === after.name) return;
    await events.publish(ORGANIZATION_EVENT_TYPE.ORGANIZATION_RENAMED, {
      organizationId: after.organizationId,
    });
  }
}
