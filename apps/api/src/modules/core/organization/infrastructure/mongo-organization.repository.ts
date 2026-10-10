import { ORGANIZATION_STATUS } from "@banijjik/contracts";
import type { OrganizationId, UserId } from "@banijjik/ids";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type { OrganizationProfileRepository } from "../application/ports/profile-and-location-repositories.js";
import type { OrganizationRepository } from "../application/ports/repositories.js";
import type { Organization } from "../domain/organization.entity.js";
import { toSlugTakenError } from "./duplicate-slug.js";
import { toOrganization, toOrganizationDocument } from "./organization.mapper.js";
import { ORGANIZATION_MODEL_NAME, type OrganizationDocument } from "./organization.schema.js";

/** Organizations are platform data: the organization IS the tenant, so there is no `organizationId` filter to forget. */
export class MongoOrganizationRepository
  implements OrganizationRepository, OrganizationProfileRepository
{
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

  async findById(organizationId: OrganizationId): Promise<Organization | undefined> {
    const document = await this.model()
      .findOne({ organizationId }, null, sessionOption(getActiveSession()))
      .lean<OrganizationDocument>();
    return document === null ? undefined : toOrganization(document);
  }

  async update(
    organization: Organization,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<Organization> {
    const saved = await updateVersioned<OrganizationDocument>({
      model: this.model(),
      filter: { organizationId: organization.organizationId },
      expectedVersion,
      update: {
        $set: {
          name: organization.name,
          defaultLocale: organization.defaultLocale,
          profile: organization.profile,
          updatedByUserId: actorUserId,
        },
      },
    });
    return toOrganization(saved);
  }

  private model() {
    return models({}).get<OrganizationDocument>(ORGANIZATION_MODEL_NAME);
  }
}
