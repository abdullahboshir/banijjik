import { UserStatus, } from "../value-objects";
export class User {
    constructor(userId = crypto.randomUUID(), 
    // Identity
    name, email, phone, 
    // Auth
    password, needsPasswordChange, passwordChangedAt, 
    // Verification
    isEmailVerified, isPhoneVerified, 
    // Status
    status, isActive, isDeleted, 
    // Authorization
    isSuperAdmin, systemRoles, directPermissions, 
    // Activity
    lastLogin, lastActiveContext, // Value object would be better, but any for now to match doc
    loginHistory, 
    // UI & Meta
    settings, 
    // Typically metadata is primitives, so Record<string, any> is fine.
    metadata, 
    // Audit
    createdBy, updatedBy, createdAt, updatedAt) {
        this.userId = userId;
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.password = password;
        this.needsPasswordChange = needsPasswordChange;
        this.passwordChangedAt = passwordChangedAt;
        this.isEmailVerified = isEmailVerified;
        this.isPhoneVerified = isPhoneVerified;
        this.status = status;
        this.isActive = isActive;
        this.isDeleted = isDeleted;
        this.isSuperAdmin = isSuperAdmin;
        this.systemRoles = systemRoles;
        this.directPermissions = directPermissions;
        this.lastLogin = lastLogin;
        this.lastActiveContext = lastActiveContext;
        this.loginHistory = loginHistory;
        this.settings = settings;
        this.metadata = metadata;
        this.createdBy = createdBy;
        this.updatedBy = updatedBy;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
    get _id() {
        return this.userId;
    }
    getPassword() {
        return this.password;
    }
    /**
     * Business Rule: Check if user is eligible to login
     */
    canLogin() {
        return (this.isActive &&
            !this.isDeleted &&
            this.status.equals(UserStatus.VALUE.ACTIVE));
    }
    /**
     * Business Rule: Change password and update state
     */
    changePassword(hashed) {
        this.password = hashed;
        this.needsPasswordChange = false;
        this.passwordChangedAt = new Date();
    }
}
//# sourceMappingURL=user.entity.js.map