import { STOREFRONT_STATUS, } from "@banijjik/contracts";
export class Storefront {
    constructor(props) {
        this.props = {
            ...props,
            storefrontId: props.storefrontId ?? crypto.randomUUID(),
            status: props.status ?? STOREFRONT_STATUS.DRAFT,
            sections: props.sections ?? [],
            createdAt: props.createdAt ?? new Date(),
            updatedAt: props.updatedAt ?? new Date(),
        };
    }
    get storefrontId() {
        return this.props.storefrontId;
    }
    get organizationId() {
        return this.props.organizationId;
    }
    get slug() {
        return this.props.slug;
    }
    get industry() {
        return this.props.industry;
    }
    get status() {
        return this.props.status;
    }
    get theme() {
        return this.props.theme;
    }
    get seo() {
        return this.props.seo;
    }
    get hero() {
        return this.props.hero;
    }
    get about() {
        return this.props.about;
    }
    get socialMedia() {
        return this.props.socialMedia;
    }
    get policies() {
        return this.props.policies;
    }
    get sections() {
        return [...this.props.sections].sort((a, b) => a.order - b.order);
    }
    get customCss() {
        return this.props.customCss;
    }
    get publishedAt() {
        return this.props.publishedAt;
    }
    updateMetadata(slug, status) {
        if (slug)
            this.props.slug = slug;
        if (status) {
            if (status === STOREFRONT_STATUS.PUBLISHED &&
                this.props.status !== STOREFRONT_STATUS.PUBLISHED) {
                this.props.publishedAt = new Date();
            }
            this.props.status = status;
        }
        this.touch();
    }
    updateBranding(theme, customCss) {
        if (theme)
            this.props.theme = { ...this.props.theme, ...theme };
        if (customCss !== undefined)
            this.props.customCss = customCss;
        this.touch();
    }
    updateHero(hero) {
        this.props.hero = hero;
        this.touch();
    }
    updateAbout(about) {
        this.props.about = about;
        this.touch();
    }
    updateSocialMedia(socialMedia) {
        this.props.socialMedia = socialMedia;
        this.touch();
    }
    updatePolicies(policies) {
        this.props.policies = policies;
        this.touch();
    }
    updateSEO(seo) {
        this.props.seo = { ...this.props.seo, ...seo };
        this.touch();
    }
    updateSections(sections) {
        this.props.sections = sections;
        this.touch();
    }
    touch() {
        this.props.updatedAt = new Date();
    }
    toPrimitives() {
        return {
            ...this.props,
        };
    }
}
//# sourceMappingURL=storefront.entity.js.map