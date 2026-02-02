import { Storefront } from "../../../../domain/entities";
import { IStorefrontRepository } from "../../../../domain/repositories";
export declare class StorefrontRepositoryImpl implements IStorefrontRepository {
    save(storefront: Storefront): Promise<void>;
    findById(storefrontId: string): Promise<Storefront | null>;
    findByOrganizationId(organizationId: string): Promise<Storefront | null>;
    findBySlug(slug: string): Promise<Storefront | null>;
    delete(storefrontId: string): Promise<void>;
}
//# sourceMappingURL=storefront.repository.impl.d.ts.map