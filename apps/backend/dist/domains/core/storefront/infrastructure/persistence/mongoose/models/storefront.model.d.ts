import mongoose, { Schema, Document } from "mongoose";
import { STOREFRONT_STATUS_ENUM, ORGANIZATION_INDUSTRY_ENUM } from "@banijjik/contracts";
export interface IStorefrontDoc extends Document {
    id: string;
    organizationId: mongoose.Types.ObjectId;
    slug: string;
    industry: (typeof ORGANIZATION_INDUSTRY_ENUM)[number];
    status: (typeof STOREFRONT_STATUS_ENUM)[number];
    theme: {
        primaryColor: string;
        secondaryColor: string;
        accentColor?: string;
        fontFamily?: string;
        logoUrl?: string;
        bannerUrl?: string;
        faviconUrl?: string;
        tagline?: string;
    };
    hero?: {
        title: string;
        subtitle?: string;
        backgroundImage?: string;
        ctaText?: string;
        ctaLink?: string;
    };
    about?: {
        title: string;
        description: string;
        image?: string;
    };
    socialMedia?: {
        facebook?: string;
        instagram?: string;
        twitter?: string;
        youtube?: string;
        linkedin?: string;
    };
    policies?: {
        privacyPolicy?: string;
        termsOfService?: string;
        refundPolicy?: string;
    };
    seo: {
        title: string;
        description: string;
        keywords: string[];
        ogImage?: string;
    };
    sections: Array<{
        id: string;
        type: string;
        title?: string;
        subtitle?: string;
        content?: Schema.Types.Mixed;
        config?: Schema.Types.Mixed;
        isVisible: boolean;
        order: number;
    }>;
    customCss?: string;
    publishedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const StorefrontModel: mongoose.Model<IStorefrontDoc, {}, {}, {}, mongoose.Document<unknown, {}, IStorefrontDoc, {}, {}> & IStorefrontDoc & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=storefront.model.d.ts.map