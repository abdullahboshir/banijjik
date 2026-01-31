import { StorefrontStatusType, IStorefrontSection, IStorefrontTheme, IStorefrontSEO, IStorefrontHero, IStorefrontAbout, IStorefrontSocialMedia, IStorefrontPolicies, OrganizationIndustryType } from "@banijjik/contracts";
export interface StorefrontProps {
    _id?: string;
    id?: string;
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
    createdAt?: Date;
    updatedAt?: Date;
}
export declare class Storefront {
    private props;
    constructor(props: StorefrontProps);
    get _id(): string | undefined;
    get id(): string | undefined;
    get organizationId(): string;
    get slug(): string;
    get industry(): OrganizationIndustryType;
    get status(): StorefrontStatusType;
    get theme(): IStorefrontTheme;
    get seo(): IStorefrontSEO;
    get hero(): IStorefrontHero | undefined;
    get about(): IStorefrontAbout | undefined;
    get socialMedia(): IStorefrontSocialMedia | undefined;
    get policies(): IStorefrontPolicies | undefined;
    get sections(): IStorefrontSection[];
    get customCss(): string | undefined;
    get publishedAt(): Date | undefined;
    updateMetadata(slug?: string, status?: StorefrontStatusType): void;
    updateBranding(theme?: Partial<IStorefrontTheme>, customCss?: string): void;
    updateHero(hero: IStorefrontHero): void;
    updateAbout(about: IStorefrontAbout): void;
    updateSocialMedia(socialMedia: IStorefrontSocialMedia): void;
    updatePolicies(policies: IStorefrontPolicies): void;
    updateSEO(seo: Partial<IStorefrontSEO>): void;
    updateSections(sections: IStorefrontSection[]): void;
    private touch;
    toPrimitives(): {
        _id?: string;
        id?: string;
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
        createdAt?: Date;
        updatedAt?: Date;
    };
}
//# sourceMappingURL=storefront.entity.d.ts.map