import type { MyOrganizationSummary } from "@banijjik/contracts";
import { publicFilePath } from "@banijjik/contracts/file";
import type { MyOrganization } from "../application/my-organization.js";

/** The public shape of an organization in `/me/orgs`. */
export function toMyOrganizationSummary(organization: MyOrganization): MyOrganizationSummary {
  return {
    organizationId: organization.organizationId,
    slug: organization.slug,
    name: organization.name,
    status: organization.status,
    roleKeys: [...organization.roleKeys],
    ...(organization.logoFileId === undefined
      ? {}
      : { logoUrl: publicFilePath(organization.logoFileId, "thumb") }),
  };
}
