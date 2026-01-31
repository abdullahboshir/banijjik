import { Storefront } from "../../domain/entities";
import { IStorefrontRepository } from "../../domain/repositories";
export declare class GetStorefrontUseCase {
    private storefrontRepo;
    constructor(storefrontRepo: IStorefrontRepository);
    executeBySlug(slug: string): Promise<Storefront | null>;
    executeByOrganization(organizationId: string): Promise<Storefront | null>;
}
//# sourceMappingURL=get-storefront.use-case.d.ts.map