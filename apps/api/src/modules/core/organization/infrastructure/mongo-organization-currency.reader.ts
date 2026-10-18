import type { CurrencyCode } from "@banijjik/contracts";
import { models } from "../../../../kernel/db/index.js";
import type { OrganizationCurrencyReader } from "../application/ports/organization-currency-reader.js";
import { ORGANIZATION_MODEL_NAME, type OrganizationDocument } from "./organization.schema.js";

/** One indexed read by `organizationId`. The organization is platform data, so no tenant context is needed. */
export class MongoOrganizationCurrencyReader implements OrganizationCurrencyReader {
  async read(organizationId: string): Promise<CurrencyCode | undefined> {
    const row = await models({})
      .get<OrganizationDocument>(ORGANIZATION_MODEL_NAME)
      .findOne({ organizationId }, { currencyCode: 1, _id: 0 })
      .lean<Pick<OrganizationDocument, "currencyCode">>();
    return row?.currencyCode;
  }
}
