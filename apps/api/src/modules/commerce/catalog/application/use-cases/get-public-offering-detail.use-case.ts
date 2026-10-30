import type { PublicOfferingDetailResponse } from "@banijjik/contracts/catalog";
import type { OrgConfigService } from "../../../../platform/entitlement/index.js";
import type { PublicCatalogReader } from "../ports/public-catalog-reader.port.js";

export interface GetPublicOfferingDetailInput {
  readonly organizationId: string;
  readonly slug: string;
  readonly locationId?: string | undefined;
}

export class GetPublicOfferingDetailUseCase {
  constructor(
    private readonly reader: PublicCatalogReader,
    private readonly orgConfig: OrgConfigService,
  ) {}

  async execute(input: GetPublicOfferingDetailInput): Promise<PublicOfferingDetailResponse | null> {
    const effective = await this.orgConfig.forOrganization(input.organizationId);
    const allowedKinds = effective.config.kinds;

    return this.reader.findPublicOfferingBySlug({
      organizationId: input.organizationId,
      slug: input.slug,
      allowedKinds,
      locationId: input.locationId,
    });
  }
}
