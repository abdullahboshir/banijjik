import type { OrganizationId } from "@banijjik/ids";
import { models } from "../../../../kernel/db/index.js";
import type { SalesTimeZoneReader } from "../application/ports/sales-ports.js";

const ORGANIZATION_MODEL_NAME = "Organization";
const DEFAULT_TIME_ZONE = "Asia/Dhaka";

interface OrganizationRow {
  timezone: string;
}

/** The order's business date and monthly counter key follow the organization's calendar. */
export function buildSalesTimeZoneReader(): SalesTimeZoneReader {
  return {
    async read(organizationId: OrganizationId): Promise<string> {
      const row = await models({})
        .get<OrganizationRow>(ORGANIZATION_MODEL_NAME)
        .findOne({ organizationId }, { timezone: 1 })
        .lean<OrganizationRow>();
      return row?.timezone ?? DEFAULT_TIME_ZONE;
    },
  };
}
