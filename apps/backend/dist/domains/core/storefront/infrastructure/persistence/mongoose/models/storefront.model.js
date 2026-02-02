import { Schema, model } from "mongoose";
import { STOREFRONT_STATUS_ENUM, STOREFRONT_SECTION_TYPE_ENUM, ORGANIZATION_INDUSTRY_ENUM, } from "@banijjik/contracts";
const StorefrontSchema = new Schema({
    storefrontId: { type: String, required: true, unique: true, index: true },
    organizationId: {
        type: String,
        required: true,
        index: true,
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
    },
    industry: {
        type: String,
        enum: ORGANIZATION_INDUSTRY_ENUM,
        required: true,
    },
    status: {
        type: String,
        enum: STOREFRONT_STATUS_ENUM,
        default: "DRAFT",
    },
    theme: {
        primaryColor: { type: String, default: "#000000" },
        secondaryColor: { type: String, default: "#ffffff" },
        accentColor: { type: String },
        fontFamily: { type: String },
        logoUrl: { type: String },
        bannerUrl: { type: String },
        faviconUrl: { type: String },
        tagline: { type: String },
    },
    hero: {
        title: { type: String },
        subtitle: { type: String },
        backgroundImage: { type: String },
        ctaText: { type: String },
        ctaLink: { type: String },
    },
    about: {
        title: { type: String },
        description: { type: String },
        image: { type: String },
    },
    socialMedia: {
        facebook: { type: String },
        instagram: { type: String },
        twitter: { type: String },
        youtube: { type: String },
        linkedin: { type: String },
    },
    policies: {
        privacyPolicy: { type: String },
        termsOfService: { type: String },
        refundPolicy: { type: String },
    },
    seo: {
        title: { type: String },
        description: { type: String },
        keywords: [{ type: String }],
        ogImage: { type: String },
    },
    sections: [
        {
            sectionId: { type: String, required: true },
            type: {
                type: String,
                enum: STOREFRONT_SECTION_TYPE_ENUM,
                required: true,
            },
            title: { type: String },
            subtitle: { type: String },
            content: { type: Schema.Types.Mixed },
            config: { type: Schema.Types.Mixed },
            isVisible: { type: Boolean, default: true },
            order: { type: Number, default: 0 },
        },
    ],
    customCss: { type: String },
    publishedAt: { type: Date },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
// Virtual for Populate Support
StorefrontSchema.virtual("organization", {
    ref: "Organization",
    localField: "organizationId",
    foreignField: "organizationId",
    justOne: true,
});
export const StorefrontModel = model("Storefront", StorefrontSchema);
//# sourceMappingURL=storefront.model.js.map