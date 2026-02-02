import { z } from "zod";
import { ORGANIZATION_INDUSTRY_ENUM, ORGANIZATION_LEGAL_TYPE_ENUM, ORGANIZATION_NATURE_ENUM, ORGANIZATION_CURRENCY_ENUM, } from "@banijjik/contracts";
export const CreateOrganizationSchema = z.object({
    name: z.string().min(3, "Organization name must be at least 3 characters"),
    email: z.string().email("Invalid email address"),
    phone: z.string().min(10, "Phone number must be at least 10 characters"),
    address: z.string().optional(),
    industry: z.enum(ORGANIZATION_INDUSTRY_ENUM).optional().default("OTHER"),
    legalType: z
        .enum(ORGANIZATION_LEGAL_TYPE_ENUM)
        .optional()
        .default("PROPRIETORSHIP"),
    nature: z.enum(ORGANIZATION_NATURE_ENUM).optional().default("SERVICE"),
    currency: z.enum(ORGANIZATION_CURRENCY_ENUM).optional().default("BDT"),
    ownerFirstName: z.string().min(2, "First name is too short"),
    ownerLastName: z.string().min(2, "Last name is too short"),
    website: z.string().url().optional().or(z.literal("")),
    supportPhone: z.string().optional(),
    establishedDate: z.coerce.date().optional(),
});
//# sourceMappingURL=create-organization.schema.js.map