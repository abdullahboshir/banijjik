import { asId } from "@banijjik/ids";
import type { OrganizationId, UserId } from "@banijjik/ids";
import { stripMongoInternals } from "../../../../kernel/db/index.js";
import { toAuthorId } from "./author-id.js";
import { Organization } from "../domain/organization.entity.js";
import type { OrganizationDocument } from "./organization.schema.js";

export function toOrganizationDocument(organization: Organization): OrganizationDocument {
  return {
    organizationId: organization.organizationId,
    slug: organization.slug,
    name: organization.name,
    industryTemplateKey: organization.industryTemplateKey,
    ownerUserId: organization.ownerUserId,
    status: organization.status,
    deployment: organization.deployment,
    countryCode: organization.countryCode,
    currencyCode: organization.currencyCode,
    timezone: organization.timezone,
    defaultLocale: organization.defaultLocale,
    profile: organization.profile,
    customFields: { ...organization.customFields },
    customFieldSearch: organization.customFieldSearch.map((entry) => ({ ...entry })),
    configVersion: organization.configVersion,
    rolesVersion: organization.rolesVersion,
    version: organization.version,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
    createdByUserId: organization.createdByUserId,
    updatedByUserId: null,
  };
}

export function toOrganization(document: OrganizationDocument): Organization {
  const stored = stripMongoInternals(document);
  return Organization.restore({
    organizationId: asId<OrganizationId>(stored.organizationId),
    slug: stored.slug,
    name: stored.name,
    industryTemplateKey: stored.industryTemplateKey,
    ownerUserId: asId<UserId>(stored.ownerUserId),
    status: stored.status,
    deployment: stored.deployment,
    countryCode: stored.countryCode,
    currencyCode: stored.currencyCode,
    timezone: stored.timezone,
    defaultLocale: stored.defaultLocale,
    profile: stored.profile ?? {},
    customFields: stored.customFields ?? {},
    customFieldSearch: stored.customFieldSearch ?? [],
    configVersion: stored.configVersion,
    rolesVersion: stored.rolesVersion,
    version: stored.version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    createdByUserId: toAuthorId(stored.createdByUserId),
  });
}
