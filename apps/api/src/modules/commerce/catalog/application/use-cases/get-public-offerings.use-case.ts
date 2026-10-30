import type { PublicOfferingListResponse, PublicOfferingsQuery } from "@banijjik/contracts/catalog";
import type { OrgConfigService } from "../../../../platform/entitlement/index.js";
import type { PublicCatalogReader } from "../ports/public-catalog-reader.port.js";

export interface GetPublicOfferingsInput {
  readonly organizationId: string;
  readonly query: PublicOfferingsQuery;
}

export class GetPublicOfferingsUseCase {
  constructor(
    private readonly reader: PublicCatalogReader,
    private readonly orgConfig: OrgConfigService,
  ) {}

  async execute(input: GetPublicOfferingsInput): Promise<PublicOfferingListResponse> {
    const effective = await this.orgConfig.forOrganization(input.organizationId);
    const allowedKinds = effective.config.kinds;

    return this.reader.findPublicOfferings({
      organizationId: input.organizationId,
      allowedKinds,
      query: input.query,
    });
  }
}
