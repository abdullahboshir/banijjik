import { Storefront } from "../entities/storefront.entity";
export interface IStorefrontRepository {
    save(storefront: Storefront): Promise<void>;
    findById(id: string): Promise<Storefront | null>;
    findByOrganizationId(organizationId: string): Promise<Storefront | null>;
    findBySlug(slug: string): Promise<Storefront | null>;
    delete(id: string): Promise<void>;
}
//# sourceMappingURL=storefront.repository.d.ts.map