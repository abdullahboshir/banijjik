import { Storefront } from "../../domain/entities";
import { STOREFRONT_STATUS } from "@banijjik/contracts";
export class SetupStorefrontUseCase {
    constructor(storefrontRepo, organizationRepo) {
        this.storefrontRepo = storefrontRepo;
        this.organizationRepo = organizationRepo;
    }
    async execute(organizationId, slug) {
        const existing = await this.storefrontRepo.findByOrganizationId(organizationId);
        if (existing)
            return existing;
        const organization = await this.organizationRepo.findById(organizationId);
        if (!organization) {
            throw new Error("Organization not found");
        }
        const storefront = new Storefront({
            storefrontId: crypto.randomUUID(),
            organizationId,
            slug,
            industry: organization.industry.getValue(),
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
//# sourceMappingURL=setup-storefront.use-case.js.map