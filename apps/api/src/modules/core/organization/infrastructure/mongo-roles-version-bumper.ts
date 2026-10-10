import type { OrganizationId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { RolesVersionBumper } from "../../iam/index.js";
import { ORGANIZATION_MODEL_NAME, type OrganizationDocument } from "./organization.schema.js";

/** Bumps `rolesVersion` with `$inc`, so two concurrent role changes both count. */
export class MongoRolesVersionBumper implements RolesVersionBumper {
  async bump(organizationId: OrganizationId): Promise<void> {
    await models({})
      .get<OrganizationDocument>(ORGANIZATION_MODEL_NAME)
      .updateOne(
        { organizationId },
        { $inc: { rolesVersion: 1 } },
        sessionOption(getActiveSession()),
      );
  }
}
