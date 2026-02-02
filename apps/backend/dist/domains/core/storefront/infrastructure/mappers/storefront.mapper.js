import { Storefront } from "../../domain/entities/storefront.entity";
export class StorefrontMapper {
    static toDomain(raw) {
        return new Storefront({
            storefrontId: raw.storefrontId,
            organizationId: raw.organizationId,
            slug: raw.slug,
            industry: raw.industry,
            status: raw.status,
            theme: raw.theme,
            seo: raw.seo,
            hero: raw.hero,
            about: raw.about,
            socialMedia: raw.socialMedia,
            policies: raw.policies,
            sections: raw.sections,
            customCss: raw.customCss,
            publishedAt: raw.publishedAt,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
        });
    }
    static toPersistence(domain) {
        const primitives = domain.toPrimitives();
        return {
            storefrontId: primitives.storefrontId,
            organizationId: primitives.organizationId,
            slug: primitives.slug,
            industry: primitives.industry,
            status: primitives.status,
            theme: primitives.theme,
            seo: primitives.seo,
            hero: primitives.hero,
            about: primitives.about,
            socialMedia: primitives.socialMedia,
            policies: primitives.policies,
            sections: primitives.sections,
            customCss: primitives.customCss,
            publishedAt: primitives.publishedAt,
        };
    }
}
//# sourceMappingURL=storefront.mapper.js.map