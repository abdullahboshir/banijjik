import { Storefront } from "../../domain/entities/storefront.entity";
import { IStorefrontDoc } from "../persistence/mongoose/models/storefront.model";

export class StorefrontMapper {
  static toDomain(raw: IStorefrontDoc): Storefront {
    return new Storefront({
      _id: raw._id.toString(),
      id: raw.id,
      organizationId: raw.organizationId.toString(),
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

  static toPersistence(domain: Storefront): any {
    const primitives = domain.toPrimitives();
    return {
      id: primitives.id,
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
