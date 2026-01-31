import { Storefront } from "../../domain/entities";
import { IStorefrontRepository } from "../../domain/repositories";
import { IOrganizationRepository } from "../../../organization/domain/repositories/organization.repository";
import { STOREFRONT_STATUS } from "@banijjik/contracts";

export class SetupStorefrontUseCase {
  constructor(
    private storefrontRepo: IStorefrontRepository,
    private organizationRepo: IOrganizationRepository,
  ) {}

  async execute(organizationId: string, slug: string): Promise<Storefront> {
    const existing =
      await this.storefrontRepo.findByOrganizationId(organizationId);
    if (existing) return existing;

    const organization = await this.organizationRepo.findById(organizationId);
    if (!organization) {
      throw new Error("Organization not found");
    }

    const storefront = new Storefront({
      organizationId,
      slug,
      industry: organization.industry,
      status: STOREFRONT_STATUS.DRAFT,
      theme: {
        primaryColor: "#000000",
        secondaryColor: "#ffffff",
      },
      seo: {
        title: "Welcome to our store",
        description: "Powered by Banijjik",
        keywords: [],
      },
      sections: [],
    });

    await this.storefrontRepo.save(storefront);
    return storefront;
  }
}
