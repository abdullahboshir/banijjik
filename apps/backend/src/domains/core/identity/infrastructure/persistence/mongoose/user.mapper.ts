import { User } from '@identity/domain';
import { IUserDocument } from './user.model';

export class UserPersistenceMapper {
  /**
   * Domain Entity -> Mongoose Document (Persistence)
   */
  static toPersistence(user: User): any {
    return {
      _id: user.id,
      firstName: user.name.firstName,
      lastName: user.name.lastName,
      email: user.email,
      phone: user.phone,
      password: user.getPassword(),
      needsPasswordChange: user.needsPasswordChange,
      passwordChangedAt: user.passwordChangedAt,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      status: user.status,
      isActive: user.isActive,
      isDeleted: user.isDeleted,
      isSuperAdmin: user.isSuperAdmin,
      globalRoles: user.globalRoles,
      directPermissions: user.directPermissions,
      businessAccess: user.businessAccess,
      lastLogin: user.lastLogin,
      loginHistory: user.loginHistory,
      settings: user.settings,
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
  static toDomain(doc: IUserDocument): User {
    return new User(
      doc._id,
      { firstName: doc.firstName, lastName: doc.lastName },
      doc.email,
      doc.phone,
      doc.password,
      doc.needsPasswordChange,
      doc.passwordChangedAt,
      doc.isEmailVerified,
      doc.isPhoneVerified,
      doc.status,
      doc.isActive,
      doc.isDeleted,
      doc.isSuperAdmin,
      doc.globalRoles,
      doc.directPermissions,
      doc.businessAccess,
      doc.lastLogin,
      doc.loginHistory,
      doc.settings,
      doc.metadata,
      doc.organization,
      doc.region,
      doc.createdBy,
      doc.updatedBy,
      doc.createdAt,
      doc.updatedAt
    );
  }
}
