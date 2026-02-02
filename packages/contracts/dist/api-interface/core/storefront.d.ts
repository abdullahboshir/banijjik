import { StorefrontStatusType, OrganizationIndustryType } from "../../constants/index";
export interface IStorefrontSection {
    type: string;
    title?: string;
    subtitle?: string;
    content?: any;
    config?: any;
    isVisible: boolean;
    order: number;
}
export interface IStorefrontHero {
    title: string;
    subtitle?: string;
    backgroundImage?: string;
    ctaText?: string;
    ctaLink?: string;
}
export interface IStorefrontAbout {
    title: string;
    description: string;
    image?: string;
}
export interface IStorefrontSocialMedia {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    youtube?: string;
    linkedin?: string;
}
export interface IStorefrontPolicies {
    privacyPolicy?: string;
    termsOfService?: string;
    refundPolicy?: string;
}
export interface IStorefrontTheme {
    primaryColor: string;
    secondaryColor: string;
    accentColor?: string;
    fontFamily?: string;
    logoUrl?: string;
    bannerUrl?: string;
    faviconUrl?: string;
    tagline?: string;
}
export interface IStorefrontSEO {
    title: string;
    description: string;
    keywords: string[];
    ogImage?: string;
}
export interface StorefrontResponseDto {
    storefrontId: string;
    organizationId: string;
    slug: string;
    industry: OrganizationIndustryType;
    status: StorefrontStatusType;
    theme: IStorefrontTheme;
    seo: IStorefrontSEO;
    hero?: IStorefrontHero;
    about?: IStorefrontAbout;
    socialMedia?: IStorefrontSocialMedia;
    policies?: IStorefrontPolicies;
    sections: IStorefrontSection[];
    customCss?: string;
    publishedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface UpdateStorefrontRequestDto {
    storefrontId: string;
    status?: StorefrontStatusType;
    theme?: Partial<IStorefrontTheme>;
    seo?: Partial<IStorefrontSEO>;
    hero?: IStorefrontHero;
    about?: IStorefrontAbout;
    socialMedia?: IStorefrontSocialMedia;
    policies?: IStorefrontPolicies;
    sections?: IStorefrontSection[];
    customCss?: string;
}
//# sourceMappingURL=storefront.d.ts.map