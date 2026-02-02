import { UserStatusType } from "../../constants/iam/user-status";
import { UserThemeType } from "../../constants/user-theme";
import { TableHeightType } from "../../constants/table-height";

import { CommonStatusType } from "../../constants/common-status";
import { PermissionEffectType } from "../../constants/iam/permission-effect";

import { IUserLastActiveContext } from "./user-context";

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

export interface IOrganizationMembership {
  role: string;
  organization: string;
  businessUnit?: string;
  status: CommonStatusType;
}

/**
 * Identity Response DTOs
 */
export interface UserResponseDto {
  userId: string;
  name: IUserName;
  email: string;
  phone: string | null;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  status: UserStatusType;
  isActive: boolean;
  isSuperAdmin: boolean;
  systemRoles: string[];
  directPermissions: IDirectPermission[];
  organizationMembership: IOrganizationMembership[];
  lastLogin: Date | null | string;
  lastActiveContext?: IUserLastActiveContext;
  loginHistory: ILoginHistory[];
  settings: IUserDetail;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface LoginResponseDto {
  accessToken: string;
  user: UserResponseDto;
}
