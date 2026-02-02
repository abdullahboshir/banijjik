import { OrganizationIndustry } from "../value-objects/industry.vo.js";
import { OrganizationLegal } from "../value-objects/legal-type.vo.js";
import { OrganizationNature } from "../value-objects/nature.vo.js";
import { OrganizationStatus } from "../value-objects/status.vo.js";
import { OrganizationLocalization } from "../value-objects/localization.vo.js";
import { OrganizationDeployment } from "../value-objects/deployment.vo.js";
export interface OrganizationProps {
    organizationId?: string;
    name: string;
    slug: string;
    industry: OrganizationIndustry;
    legalType: OrganizationLegal;
    nature: OrganizationNature;
    status: OrganizationStatus;
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
    get organizationId(): string | undefined;
    get name(): string;
    get slug(): string;
    get industry(): OrganizationIndustry;
    get legalType(): OrganizationLegal;
    get nature(): OrganizationNature;
    get status(): OrganizationStatus;
    get deployment(): OrganizationDeployment;
    get localization(): OrganizationLocalization;
    get metadata(): Record<string, any> | undefined;
    get email(): string | undefined;
    get phone(): string | undefined;
    get supportPhone(): string | undefined;
    get establishedDate(): Date | undefined;
    get address(): string | undefined;
    get website(): string | undefined;
    update(props: Partial<OrganizationProps>): void;
    toJSON(): {
        industry: "GYM" | "COACHING" | "SALON" | "RETAIL" | "RESTAURANT" | "CLINIC" | "HOSTEL" | "PARLOR" | "IT" | "OTHER";
        legalType: "PROPRIETORSHIP" | "PARTNERSHIP" | "PRIVATE_LIMITED" | "PUBLIC_LIMITED" | "NON_PROFIT" | "TRUST";
        nature: "SERVICE" | "PRODUCT" | "HYBRID";
        status: "PENDING" | "ACTIVE" | "SUSPENDED" | "ARCHIVED" | "INACTIVE";
        localization: import("../value-objects/localization.vo.js").ILocalizationProps;
        deployment: import("../value-objects/deployment.vo.js").IDeploymentProps;
        organizationId?: string;
        name: string;
        slug: string;
        email?: string;
        phone?: string;
        supportPhone?: string;
        website?: string;
        address?: string;
        establishedDate?: Date;
        metadata?: Record<string, any>;
        createdAt?: Date;
        updatedAt?: Date;
    };
}
//# sourceMappingURL=organization.entity.d.ts.map