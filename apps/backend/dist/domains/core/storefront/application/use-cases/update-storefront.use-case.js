export class UpdateStorefrontUseCase {
    constructor(storefrontRepo) {
        this.storefrontRepo = storefrontRepo;
    }
    async execute(organizationId, data) {
        const storefront = await this.storefrontRepo.findByOrganizationId(organizationId);
        if (!storefront)
            throw new Error("Storefront not found");
        if (data.status)
            storefront.updateMetadata(undefined, data.status);
        if (data.theme || data.customCss !== undefined) {
            storefront.updateBranding(data.theme, data.customCss);
        }
        if (data.hero)
            storefront.updateHero(data.hero);
        if (data.about)
            storefront.updateAbout(data.about);
        if (data.socialMedia)
            storefront.updateSocialMedia(data.socialMedia);
        if (data.policies)
            storefront.updatePolicies(data.policies);
        if (data.seo)
            storefront.updateSEO(data.seo);
        if (data.sections)
            storefront.updateSections(data.sections);
        await this.storefrontRepo.save(storefront);
        return storefront;
    }
}
//# sourceMappingURL=update-storefront.use-case.js.map