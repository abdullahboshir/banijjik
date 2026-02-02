import { PortalType } from "../../constants/iam/portal-type";
import { UserProfileType } from "../../constants/consumer-profile-type";
import { OrganizationIndustryType } from "../../constants/organization";

export interface IUserLastActiveContext {
  portal: PortalType;
  organizationId?: string; // For ORGANIZATION and CONSUMER portals
  roleId?: string; // Active role in that organization (e.g. Teacher vs Guardian)

  // Richer context for switching logic
  activeProfileType?: UserProfileType; // e.g. GUARDIAN, STUDENT
  activeIndustryType?: OrganizationIndustryType; // e.g. COACHING, CLINIC

  profileId?: string; // Specific domain profile (e.g. TeacherProfile ID)
  lastAccessedAt?: Date; // Timestamp
}
