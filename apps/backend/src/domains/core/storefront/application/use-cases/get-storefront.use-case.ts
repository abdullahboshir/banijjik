import { Storefront } from "../../domain/entities";
import { IStorefrontRepository } from "../../domain/repositories";

export class GetStorefrontUseCase {
  constructor(private storefrontRepo: IStorefrontRepository) {}

  async executeBySlug(slug: string): Promise<Storefront | null> {
    return this.storefrontRepo.findBySlug(slug);
  }

  async executeByOrganization(
    organizationId: string,
  ): Promise<Storefront | null> {
    return this.storefrontRepo.findByOrganizationId(organizationId);
  }
}
