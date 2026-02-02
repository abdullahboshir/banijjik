import { z } from "zod";
export declare const StorefrontSectionSchema: z.ZodObject<{
    type: z.ZodEnum<{
        HERO: "HERO";
        ABOUT: "ABOUT";
        FEATURES: "FEATURES";
        SERVICES: "SERVICES";
        TESTIMONIALS: "TESTIMONIALS";
        FAQ: "FAQ";
        GALLERY: "GALLERY";
        CONTACT: "CONTACT";
        BOOKING: "BOOKING";
        SERIAL: "SERIAL";
        APPOINTMENT: "APPOINTMENT";
    }>;
    title: z.ZodString;
    subtitle: z.ZodOptional<z.ZodString>;
    content: z.ZodAny;
    order: z.ZodDefault<z.ZodNumber>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const StorefrontSEOSchema: z.ZodObject<{
    metaTitle: z.ZodString;
    metaDescription: z.ZodOptional<z.ZodString>;
    keywords: z.ZodDefault<z.ZodArray<z.ZodString>>;
    ogImage: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const UpdateStorefrontSchema: z.ZodObject<{
    organizationId: z.ZodString;
    hero: z.ZodOptional<z.ZodObject<{
        title: z.ZodString;
        subtitle: z.ZodOptional<z.ZodString>;
        backgroundImage: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    about: z.ZodOptional<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodString;
        image: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            HERO: "HERO";
            ABOUT: "ABOUT";
            FEATURES: "FEATURES";
            SERVICES: "SERVICES";
            TESTIMONIALS: "TESTIMONIALS";
            FAQ: "FAQ";
            GALLERY: "GALLERY";
            CONTACT: "CONTACT";
            BOOKING: "BOOKING";
            SERIAL: "SERIAL";
            APPOINTMENT: "APPOINTMENT";
        }>;
        title: z.ZodString;
        subtitle: z.ZodOptional<z.ZodString>;
        content: z.ZodAny;
        order: z.ZodDefault<z.ZodNumber>;
        isActive: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>>;
    seo: z.ZodOptional<z.ZodObject<{
        metaTitle: z.ZodString;
        metaDescription: z.ZodOptional<z.ZodString>;
        keywords: z.ZodDefault<z.ZodArray<z.ZodString>>;
        ogImage: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    customCss: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
//# sourceMappingURL=storefront.schema.d.ts.map