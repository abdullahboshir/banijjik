import { z } from "zod";
export declare const CreateOrganizationSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    phone: z.ZodString;
    address: z.ZodOptional<z.ZodString>;
    industry: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        GYM: "GYM";
        COACHING: "COACHING";
        SALON: "SALON";
        RETAIL: "RETAIL";
        RESTAURANT: "RESTAURANT";
        CLINIC: "CLINIC";
        HOSTEL: "HOSTEL";
        PARLOR: "PARLOR";
        IT: "IT";
        OTHER: "OTHER";
    }>>>;
    legalType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        PROPRIETORSHIP: "PROPRIETORSHIP";
        PARTNERSHIP: "PARTNERSHIP";
        PRIVATE_LIMITED: "PRIVATE_LIMITED";
        PUBLIC_LIMITED: "PUBLIC_LIMITED";
        NON_PROFIT: "NON_PROFIT";
        TRUST: "TRUST";
    }>>>;
    nature: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        SERVICE: "SERVICE";
        PRODUCT: "PRODUCT";
        HYBRID: "HYBRID";
    }>>>;
    currency: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        BDT: "BDT";
        USD: "USD";
    }>>>;
    ownerFirstName: z.ZodString;
    ownerLastName: z.ZodString;
    website: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    supportPhone: z.ZodOptional<z.ZodString>;
    establishedDate: z.ZodOptional<z.ZodCoercedDate<unknown>>;
}, z.core.$strip>;
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;
//# sourceMappingURL=create-organization.schema.d.ts.map