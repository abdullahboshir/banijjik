import { USER_ROLE } from "@banijjik/contracts";
import {
  Email,
  Phone,
  UserName,
  UserStatus,
  OrganizationMembershipVO,
  DirectPermission,
  LoginHistory,
  UserSettings,
} from "../value-objects";

export class User {
  constructor(
    public readonly id: string,

    // Identity
    public name: UserName,
    public email: Email,
    public phone: Phone | null,

    // Auth
    private password: string | null,
    public needsPasswordChange: boolean,
    public passwordChangedAt: Date | null,

    // Verification
    public isEmailVerified: boolean,
    public isPhoneVerified: boolean,

    // Status
    public status: UserStatus,
    public isActive: boolean,
    public isDeleted: boolean,

    // Authorization
    public isSuperAdmin: boolean,
    public globalRoles: string[],
    public directPermissions: DirectPermission[],

    // Activity
    public lastLogin: Date | null,
    public loginHistory: LoginHistory[],

    // UI & Meta
    public settings: UserSettings,
    // Typically metadata is primitives, so Record<string, any> is fine.
    public metadata: Record<string, any>,

    // Tenant (Global/Default Context)
    public organization?: string,
    public region?: string,

    // Audit
    public createdBy?: string,
    public updatedBy?: string,
    public createdAt?: Date,
    public updatedAt?: Date,
  ) {}

  public getPassword(): string | null {
    return this.password;
  }

  /**
   * Business Rule: Check if user is eligible to login
   */
  canLogin(): boolean {
    return (
      this.isActive &&
      !this.isDeleted &&
      this.status.equals(UserStatus.VALUE.ACTIVE)
    );
  }

  /**
   * Business Rule: Change password and update state
   */
  changePassword(hashed: string) {
    this.password = hashed;
    this.needsPasswordChange = false;
    this.passwordChangedAt = new Date();
  }
}
