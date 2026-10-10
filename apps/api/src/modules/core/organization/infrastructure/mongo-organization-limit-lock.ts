import type { OrganizationId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { OrganizationLimitLock } from "../application/ports/profile-and-location-repositories.js";
import { ORGANIZATION_MODEL_NAME, type OrganizationDocument } from "./organization.schema.js";

/**
 * Writes a counter on the organization document inside the surrounding transaction. MongoDB
 * turns two concurrent writers of the same document into a write conflict, so limit-checked
 * creates of one organization run one after the other and the loser counts again after its retry.
 */
export class MongoOrganizationLimitLock implements OrganizationLimitLock {
  async acquire(organizationId: OrganizationId): Promise<void> {
    await models({})
      .get<OrganizationDocument>(ORGANIZATION_MODEL_NAME)
      .updateOne(
        { organizationId },
        { $inc: { limitWriteVersion: 1 } },
        // A guard, not a change of the organization: updatedAt stays.
        { ...sessionOption(getActiveSession()), timestamps: false },
      );
  }
}
