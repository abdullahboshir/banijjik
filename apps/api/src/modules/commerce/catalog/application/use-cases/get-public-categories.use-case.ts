import type { PublicCategoriesResponse } from "@banijjik/contracts/catalog";
import type { OrgConfigService } from "../../../../platform/entitlement/index.js";
import type { PublicCatalogReader } from "../ports/public-catalog-reader.port.js";

export interface GetPublicCategoriesInput {
  readonly organizationId: string;
  readonly locationId?: string | undefined;
}

export class GetPublicCategoriesUseCase {
  constructor(
    private readonly reader: PublicCatalogReader,
    private readonly orgConfig: OrgConfigService,
  ) {}

  async execute(input: GetPublicCategoriesInput): Promise<PublicCategoriesResponse> {
    const effective = await this.orgConfig.forOrganization(input.organizationId);
    const allowedKinds = effective.config.kinds;

    return this.reader.findPublicCategories({
      organizationId: input.organizationId,
      allowedKinds,
      locationId: input.locationId,
    });
  }
}
