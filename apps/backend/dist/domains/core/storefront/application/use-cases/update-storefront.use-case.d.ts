import { UpdateStorefrontRequestDto } from "@banijjik/contracts";
import { IStorefrontRepository } from "../../domain/repositories";
import { Storefront } from "../../domain/entities";
export declare class UpdateStorefrontUseCase {
    private storefrontRepo;
    constructor(storefrontRepo: IStorefrontRepository);
    execute(organizationId: string, data: UpdateStorefrontRequestDto): Promise<Storefront>;
}
//# sourceMappingURL=update-storefront.use-case.d.ts.map