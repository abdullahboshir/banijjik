import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { ConfigVersionBumper } from "../../../../kernel/tenancy/index.js";
import { ORGANIZATION_MODEL_NAME, type OrganizationDocument } from "./organization.schema.js";

/** Bumps `configVersion` with `$inc`, so two concurrent subscription changes both count. */
export class MongoConfigVersionBumper implements ConfigVersionBumper {
  async bump(organizationId: string): Promise<void> {
    await models({})
      .get<OrganizationDocument>(ORGANIZATION_MODEL_NAME)
      .updateOne(
        { organizationId },
        { $inc: { configVersion: 1 } },
        sessionOption(getActiveSession()),
      );
  }
}
