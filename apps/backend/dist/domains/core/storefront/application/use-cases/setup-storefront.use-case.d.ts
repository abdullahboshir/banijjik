import { Storefront } from "../../domain/entities";
import { IStorefrontRepository } from "../../domain/repositories";
import { IOrganizationRepository } from "../../../organization/domain/repositories/organization.repository";
export declare class SetupStorefrontUseCase {
    private storefrontRepo;
    private organizationRepo;
    constructor(storefrontRepo: IStorefrontRepository, organizationRepo: IOrganizationRepository);
    execute(organizationId: string, slug: string): Promise<Storefront>;
}
//# sourceMappingURL=setup-storefront.use-case.d.ts.map