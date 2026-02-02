import { Types } from "mongoose";
import { Role } from "@iam/domain";
import { IRoleDoc } from "../models/role.model";

export class RoleMapper {
  static toDomain(doc: IRoleDoc): Role {
    return Role.create({
      roleId: doc.roleId,
      name: doc.name,
      key: doc.key,
      organizationId: doc.organizationId,
      permissions: doc.permissions,
      isSystem: doc.isSystem,
    });
  }

  static toPersistence(domain: Role): any {
    return {
      roleId: domain.roleId,
      name: domain.name,
      key: domain.key,
      organizationId: domain.organizationId || null,
      permissions: domain.permissions || [],
      isSystem: domain.isSystem,
    };
  }
}
