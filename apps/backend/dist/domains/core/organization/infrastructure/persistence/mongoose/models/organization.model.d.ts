import mongoose, { Document } from "mongoose";
import { ORGANIZATION_INDUSTRY_ENUM, ORGANIZATION_LEGAL_TYPE_ENUM, ORGANIZATION_NATURE_ENUM, ORGANIZATION_STATUS_ENUM, DEPLOYMENT_TYPE_ENUM, ORGANIZATION_CURRENCY_ENUM, ORGANIZATION_LANGUAGE_ENUM, ORGANIZATION_STORAGE_PROVIDER_ENUM } from "@banijjik/contracts";
export interface IOrganizationDocument extends Document {
    id: string;
    name: string;
    slug: string;
    industry: (typeof ORGANIZATION_INDUSTRY_ENUM)[number];
    legalType: (typeof ORGANIZATION_LEGAL_TYPE_ENUM)[number];
    nature: (typeof ORGANIZATION_NATURE_ENUM)[number];
    status: (typeof ORGANIZATION_STATUS_ENUM)[number];
    email?: string;
    phone?: string;
    supportPhone?: string;
    website?: string;
    address?: string;
    establishedDate?: Date;
    localization: {
        currency: (typeof ORGANIZATION_CURRENCY_ENUM)[number];
        language: (typeof ORGANIZATION_LANGUAGE_ENUM)[number];
        timezone: string;
        dateFormat: string;
    };
    deployment: {
        type: (typeof DEPLOYMENT_TYPE_ENUM)[number];
        customDomain?: string;
        databaseUri?: string;
        serverRegion?: string;
        dbCluster?: string;
        customEnv?: Record<string, any>;
        storageConfig?: {
            provider: (typeof ORGANIZATION_STORAGE_PROVIDER_ENUM)[number];
            bucket?: string;
            region?: string;
        };
    };
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export declare const OrganizationModel: mongoose.Model<IOrganizationDocument, {}, {}, {}, mongoose.Document<unknown, {}, IOrganizationDocument, {}, {}> & IOrganizationDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=organization.model.d.ts.map