import { Storefront } from "../entities/storefront.entity";

export interface IStorefrontRepository {
  save(storefront: Storefront): Promise<void>;
  findById(storefrontId: string): Promise<Storefront | null>;
  findByOrganizationId(organizationId: string): Promise<Storefront | null>;
  findBySlug(slug: string): Promise<Storefront | null>;
  delete(storefrontId: string): Promise<void>;
}
