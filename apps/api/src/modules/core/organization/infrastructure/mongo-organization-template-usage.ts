import type { IndustryTemplateKey } from "@banijjik/contracts";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import { ORGANIZATION_MODEL_NAME, type OrganizationDocument } from "./organization.schema.js";

/** Counts organizations on a template key. Organizations are platform data (tenancy NONE). */
export class MongoOrganizationTemplateUsage {
  async countByTemplateKey(templateKey: IndustryTemplateKey): Promise<number> {
    return this.model().countDocuments(
      { industryTemplateKey: templateKey },
      sessionOption(getActiveSession()),
    );
  }

  private model() {
    return models({}).get<OrganizationDocument>(ORGANIZATION_MODEL_NAME);
  }
}
