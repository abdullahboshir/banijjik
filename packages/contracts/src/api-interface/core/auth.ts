import { UserStatusType } from "../../constants/user-status";
import { UserThemeType } from "../../constants/user-theme";
import { TableHeightType } from "../../constants/table-height";
import { PermissionEffectType } from "../../constants/permission-effect";
import { CommonStatusType } from "../../constants/common-status";

/**
 * Identity Base Types
 */
export interface IUserName {
  firstName: string;
  lastName?: string;
}

export interface ILoginHistory {
  date: Date;
  ip: string;
  userAgent: string;
}

export interface IUserDetail {
  theme: UserThemeType;
  tableHeight: TableHeightType;
  [key: string]: any;
}

export interface IDirectPermission {
  permissionId: string;
  effect: PermissionEffectType;
}

export interface IBusinessAccess {
  role: string;
  organization: string;
  businessUnit?: string;
  status: CommonStatusType;
}

/**
 * Identity Response DTOs
 */
export interface UserResponseDto {
  id: string;
  name: IUserName;
  email: string;
  phone: string | null;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  status: UserStatusType;
  isActive: boolean;
  isSuperAdmin: boolean;
  globalRoles: string[];
  directPermissions: IDirectPermission[];
  businessAccess: IBusinessAccess[];
  lastLogin: Date | null | string;
  loginHistory: ILoginHistory[];
  settings: IUserDetail;
  organization?: string;
  region?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface LoginResponseDto {
  accessToken: string;
  user: UserResponseDto;
}
