export class GetStorefrontUseCase {
    constructor(storefrontRepo) {
        this.storefrontRepo = storefrontRepo;
    }
    async executeBySlug(slug) {
        return this.storefrontRepo.findBySlug(slug);
    }
    async executeByOrganization(organizationId) {
        return this.storefrontRepo.findByOrganizationId(organizationId);
    }
}
//# sourceMappingURL=get-storefront.use-case.js.map