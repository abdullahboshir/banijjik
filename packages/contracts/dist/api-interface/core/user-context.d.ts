import { PortalType } from "../../constants/iam/portal-type";
import { UserProfileType } from "../../constants/consumer-profile-type";
import { OrganizationIndustryType } from "../../constants/organization";
export interface IUserLastActiveContext {
    portal: PortalType;
    organizationId?: string;
    roleId?: string;
    activeProfileType?: UserProfileType;
    activeIndustryType?: OrganizationIndustryType;
    profileId?: string;
    lastAccessedAt?: Date;
}
//# sourceMappingURL=user-context.d.ts.map