import type { OrganizationId } from "@banijjik/ids";
import type { Model } from "mongoose";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { models } from "../../../../kernel/db/index.js";
import type { SalesOwnerReader, SalesTimeZoneReader } from "../application/ports/sales-ports.js";

const ORGANIZATION_MODEL_NAME = "Organization";
const DEFAULT_TIME_ZONE = "Asia/Dhaka";

interface OrganizationRow {
  timezone: string;
  ownerUserId: string;
}

function organizationModel(): Model<OrganizationRow> {
  return models({}).get<OrganizationRow>(ORGANIZATION_MODEL_NAME);
}

/** The order's business date and monthly counter key follow the organization's calendar. */
export function buildSalesTimeZoneReader(): SalesTimeZoneReader {
  return {
    async read(organizationId: OrganizationId): Promise<string> {
      const row = await organizationModel()
        .findOne({ organizationId }, { timezone: 1 })
        .lean<Pick<OrganizationRow, "timezone"> | null>();
      return row?.timezone ?? DEFAULT_TIME_ZONE;
    },
  };
}

/**
 * The OWNER system role is never grantable to another member (core/organization assignment rules),
 * so the user stored as `ownerUserId` is the only OWNER. The read stays inside the active tenant;
 * the role table would need a cross-organization filter, which the tenant plugin refuses.
 */
export function buildSalesOwnerReader(): SalesOwnerReader {
  return {
    async isOwner(): Promise<boolean> {
      const { organizationId, userId } = getRequestContext();
      if (organizationId === undefined || userId === undefined) return false;
      const row = await organizationModel()
        .findOne({ organizationId }, { ownerUserId: 1 })
        .lean<Pick<OrganizationRow, "ownerUserId"> | null>();
      return row?.ownerUserId === userId;
    },
  };
}
