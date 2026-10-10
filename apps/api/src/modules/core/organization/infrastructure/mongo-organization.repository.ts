import { ORGANIZATION_STATUS } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { OrganizationRepository } from "../application/ports/repositories.js";
import type { Organization } from "../domain/organization.entity.js";
import { toSlugTakenError } from "./duplicate-slug.js";
import { toOrganization, toOrganizationDocument } from "./organization.mapper.js";
import { ORGANIZATION_MODEL_NAME, type OrganizationDocument } from "./organization.schema.js";

/** Organizations are platform data: the organization IS the tenant, so there is no `organizationId` filter to forget. */
export class MongoOrganizationRepository implements OrganizationRepository {
  async insert(organization: Organization): Promise<void> {
    try {
      await this.model().create(
        [toOrganizationDocument(organization)],
        sessionOption(getActiveSession()),
      );
    } catch (error) {
      throw toSlugTakenError(error);
    }
  }

  async isSlugTaken(slug: string): Promise<boolean> {
    const found = await this.model()
      .exists({ slug })
      .session(getActiveSession() ?? null);
    return found !== null;
  }

  async findOpenByIds(organizationIds: readonly OrganizationId[]): Promise<Organization[]> {
    const documents = await this.model()
      .find(
        { organizationId: { $in: organizationIds }, status: { $ne: ORGANIZATION_STATUS.CLOSED } },
        null,
        sessionOption(getActiveSession()),
      )
      .lean<OrganizationDocument[]>();
    return documents.map(toOrganization);
  }

  private model() {
    return models({}).get<OrganizationDocument>(ORGANIZATION_MODEL_NAME);
  }
}
