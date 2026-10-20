import { ORGANIZATION_STATUS, SYSTEM_REASON } from "@banijjik/contracts";
import { asId, type OrganizationId } from "@banijjik/ids";
import { runAsSystem } from "../context/index.js";
import { models } from "../db/index.js";

const ORGANIZATION_MODEL_NAME = "Organization";

interface OrganizationIdRow {
  organizationId: string;
}

/**
 * ACTIVE organization ids for scheduled jobs. Runs only under SCHEDULED_JOB (kernel/jobs).
 */
export async function listActiveOrganizationIds(): Promise<readonly OrganizationId[]> {
  return runAsSystem(SYSTEM_REASON.SCHEDULED_JOB, async () => {
    const rows = await models({})
      .get<OrganizationIdRow>(ORGANIZATION_MODEL_NAME)
      .find({ status: ORGANIZATION_STATUS.ACTIVE }, { organizationId: 1 })
      .lean<OrganizationIdRow[]>();
    return rows.map((row) => asId<OrganizationId>(row.organizationId));
  });
}
