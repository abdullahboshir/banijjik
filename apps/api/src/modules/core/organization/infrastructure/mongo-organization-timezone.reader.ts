import { models } from "../../../../kernel/db/index.js";
import type { OrganizationTimezoneReader } from "../application/ports/organization-timezone-reader.js";
import { ORGANIZATION_MODEL_NAME, type OrganizationDocument } from "./organization.schema.js";

/** One indexed read by `organizationId`. The organization is platform data, so no tenant context is needed. */
export class MongoOrganizationTimezoneReader implements OrganizationTimezoneReader {
  async read(organizationId: string): Promise<string | undefined> {
    const row = await models({})
      .get<OrganizationDocument>(ORGANIZATION_MODEL_NAME)
      .findOne({ organizationId }, { timezone: 1, _id: 0 })
      .lean<Pick<OrganizationDocument, "timezone">>();
    return row?.timezone;
  }
}
