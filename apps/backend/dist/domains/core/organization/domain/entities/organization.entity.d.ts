import { OrganizationIndustryType, OrganizationLegalType, OrganizationNatureType, OrganizationStatusType, DeploymentType, OrganizationCurrencyType, OrganizationStorageProviderType } from "@banijjik/contracts";
export interface OrganizationLocalization {
    currency: OrganizationCurrencyType;
    language: string;
    timezone: string;
    dateFormat: string;
}
export interface OrganizationLocalization {
    currency: OrganizationCurrencyType;
    language: string;
    timezone: string;
    dateFormat: string;
}
export interface OrganizationDeployment {
    type: DeploymentType;
    customDomain?: string;
    databaseUri?: string;
    serverRegion?: string;
    dbCluster?: string;
    customEnv?: Record<string, any>;
    storageConfig?: {
        provider: OrganizationStorageProviderType;
        bucket?: string;
        region?: string;
    };
}
export interface OrganizationProps {
    _id?: string;
    id?: string;
    name: string;
    slug: string;
    industry: OrganizationIndustryType;
    legalType: OrganizationLegalType;
    nature: OrganizationNatureType;
    status: OrganizationStatusType;
    email?: string;
    phone?: string;
    supportPhone?: string;
    website?: string;
    address?: string;
    establishedDate?: Date;
    localization: OrganizationLocalization;
    deployment: OrganizationDeployment;
    metadata?: Record<string, any>;
    createdAt?: Date;
    updatedAt?: Date;
}
export declare class Organization {
    private props;
    constructor(props: OrganizationProps);
    get _id(): string | undefined;
    get id(): string | undefined;
    get name(): string;
    get slug(): string;
    get industry(): "GYM" | "COACHING" | "SALON" | "RETAIL" | "RESTAURANT" | "CLINIC" | "HOSTEL" | "PARLOR" | "OTHER";
    get legalType(): "PROPRIETORSHIP" | "PARTNERSHIP" | "PRIVATE_LIMITED" | "PUBLIC_LIMITED" | "NON_PROFIT" | "TRUST";
    get nature(): "SERVICE" | "PRODUCT" | "HYBRID";
    get status(): "PENDING" | "ACTIVE" | "SUSPENDED" | "ARCHIVED" | "INACTIVE";
    get deployment(): OrganizationDeployment;
    get metadata(): Record<string, any> | undefined;
    update(props: Partial<OrganizationProps>): void;
    toJSON(): {
        _id?: string;
        id?: string;
        name: string;
        slug: string;
        industry: OrganizationIndustryType;
        legalType: OrganizationLegalType;
        nature: OrganizationNatureType;
        status: OrganizationStatusType;
        email?: string;
        phone?: string;
        supportPhone?: string;
        website?: string;
        address?: string;
        establishedDate?: Date;
        localization: OrganizationLocalization;
        deployment: OrganizationDeployment;
        metadata?: Record<string, any>;
        createdAt?: Date;
        updatedAt?: Date;
    };
}
//# sourceMappingURL=organization.entity.d.ts.map