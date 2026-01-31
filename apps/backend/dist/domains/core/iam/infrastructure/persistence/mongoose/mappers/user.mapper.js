import { User } from "@iam/domain";
import { Email, Phone, UserName, UserStatus, DirectPermission, LoginHistory, UserSettings, } from "@iam/domain/value-objects";
export class UserPersistenceMapper {
    /**
     * Domain Entity -> Mongoose Document (Persistence)
     */
    static toPersistence(user) {
        return {
            _id: user.id,
            firstName: user.name.getFirstName(),
            lastName: user.name.getLastName(),
            email: user.email.toString(),
            phone: user.phone ? user.phone.toString() : null,
            password: user.getPassword(),
            needsPasswordChange: user.needsPasswordChange,
            passwordChangedAt: user.passwordChangedAt,
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified,
            status: user.status.getValue(),
            isActive: user.isActive,
            isDeleted: user.isDeleted,
            isSuperAdmin: user.isSuperAdmin,
            globalRoles: user.globalRoles,
            directPermissions: user.directPermissions.map((p) => p.toObject()),
            lastLogin: user.lastLogin,
            loginHistory: user.loginHistory.map((h) => h.toObject()),
            settings: user.settings.toObject(),
            metadata: user.metadata,
            organization: user.organization,
            region: user.region,
            createdBy: user.createdBy,
            updatedBy: user.updatedBy,
        };
    }
    /**
     * Mongoose Document -> Domain Entity
     */
    static toDomain(doc) {
        return new User(doc._id, UserName.create(doc.firstName, doc.lastName), Email.create(doc.email), Phone.createOptional(doc.phone), doc.password, doc.needsPasswordChange, doc.passwordChangedAt, doc.isEmailVerified, doc.isPhoneVerified, UserStatus.from(doc.status), doc.isActive, doc.isDeleted, doc.isSuperAdmin, doc.globalRoles, 
        // Handle potential null/undefined for arrays coming from DB
        (doc.directPermissions || []).map((p) => DirectPermission.create(p)), doc.lastLogin, (doc.loginHistory || []).map((h) => LoginHistory.create(h)), UserSettings.create(doc.settings || { theme: "SYSTEM", tableHeight: "MEDIUM" }), doc.metadata, doc.organization, doc.region, doc.createdBy, doc.updatedBy, doc.createdAt, doc.updatedAt);
    }
}
//# sourceMappingURL=user.mapper.js.map