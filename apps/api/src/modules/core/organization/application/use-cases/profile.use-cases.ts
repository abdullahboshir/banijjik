import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  ORGANIZATION_EVENT_TYPE,
  type PreferredLocale,
  type OrganizationProfileFields,
} from "@banijjik/contracts";
import type { OrganizationId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import { recordNotFound } from "../../domain/errors.js";
import type { Organization } from "../../domain/organization.entity.js";
import { diffAuditFields, type AuditFields } from "../audit-diff.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type { OrganizationProfileRepository } from "../ports/profile-and-location-repositories.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

/** The business profile of the active organization. Any active member may read it (plan 1.7b decision 3). */
export class GetProfileUseCase {
  constructor(private readonly organizations: OrganizationProfileRepository) {}

  async execute(input: { readonly organizationId: OrganizationId }): Promise<Organization> {
    const organization = await this.organizations.findById(input.organizationId);
    if (organization === undefined) throw recordNotFound();
    return organization;
  }
}

export interface UpdateProfileInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly version: number;
  readonly name?: string;
  readonly defaultLocale?: PreferredLocale;
  readonly profile?: OrganizationProfileFields;
}

export interface UpdateProfileDependencies {
  readonly organizations: OrganizationProfileRepository;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly audit: AuditRecorder;
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
  };
}

/**
 * Edits the name, the default language and the profile. The slug, currency, timezone, country
 * and industry template are not editable here. A stale version is a 409; the audit entry and
 * the events are written in the same transaction as the change.
 */
export class UpdateProfileUseCase {
  constructor(private readonly dependencies: UpdateProfileDependencies) {}

  async execute(input: UpdateProfileInput): Promise<Organization> {
    const { organizations, unitOfWork } = this.dependencies;
    const existing = await organizations.findById(input.organizationId);
    if (existing === undefined) throw recordNotFound();
    const edited = existing.withProfileChanges({
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.defaultLocale === undefined ? {} : { defaultLocale: input.defaultLocale }),
      ...(input.profile === undefined ? {} : { profile: input.profile }),
    });
    return unitOfWork.run(async () => {
      const saved = await organizations.update(edited, input.version, input.actorUserId);
      await this.record(existing, saved);
      return saved;
    });
  }

  private async record(before: Organization, after: Organization): Promise<void> {
    const { audit, events } = this.dependencies;
    await audit.record({
      action: AUDIT_ACTION.ORGANIZATION_UPDATED,
      entityType: AUDIT_ENTITY_TYPE.organization,
      entityId: after.organizationId,
      changes: diffAuditFields(auditFieldsOf(before), auditFieldsOf(after)),
    });
    if (before.name === after.name) return;
    await events.publish(ORGANIZATION_EVENT_TYPE.ORGANIZATION_RENAMED, {
      organizationId: after.organizationId,
    });
  }
}
