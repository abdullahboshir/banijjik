import mongoose, { Schema, model, Document } from "mongoose";
import {
  STOREFRONT_STATUS_ENUM,
  STOREFRONT_SECTION_TYPE_ENUM,
  ORGANIZATION_INDUSTRY_ENUM,
} from "@banijjik/contracts";

export interface IStorefrontDoc extends Document {
  storefrontId: string;
  organizationId: string;
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
    sectionId: string;
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

const StorefrontSchema = new Schema<IStorefrontDoc>(
  {
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual for Populate Support
StorefrontSchema.virtual("organization", {
  ref: "Organization",
  localField: "organizationId",
  foreignField: "organizationId",
  justOne: true,
});

export const StorefrontModel = model<IStorefrontDoc>(
  "Storefront",
  StorefrontSchema,
);
