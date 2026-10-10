import { models } from "../../../../kernel/db/index.js";
import type {
  OrganizationConfigSnapshot,
  OrganizationConfigSource,
} from "../application/ports/organization-config-source.js";
import { ORGANIZATION_MODEL_NAME, type OrganizationDocument } from "./organization.schema.js";

type SnapshotRow = Pick<OrganizationDocument, "industryTemplateKey" | "configVersion">;

/** One indexed read by `organizationId`. The organization is platform data, so no tenant context is needed. */
export class MongoOrganizationConfigSource implements OrganizationConfigSource {
  async find(organizationId: string): Promise<OrganizationConfigSnapshot | undefined> {
    const row = await models({})
      .get<OrganizationDocument>(ORGANIZATION_MODEL_NAME)
      .findOne({ organizationId }, { industryTemplateKey: 1, configVersion: 1, _id: 0 })
      .lean<SnapshotRow>();
    if (row === null) return undefined;
    return { industryTemplateKey: row.industryTemplateKey, configVersion: row.configVersion };
  }
}
