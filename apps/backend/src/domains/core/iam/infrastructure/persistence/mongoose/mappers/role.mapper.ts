import { Types } from "mongoose";
import { Role } from "@iam/domain";
import { IRoleDoc } from "../models/role.model";

export class RoleMapper {
  static toDomain(doc: IRoleDoc): Role {
    return Role.create({
      id: doc._id.toString(),
      name: doc.name,
      key: doc.key,
      organizationId: doc.organizationId?.toString(),
      permissions: doc.permissions.map((p) => p.toString()),
      isSystem: doc.isSystem,
    });
  }

  static toPersistence(domain: Role): any {
    return {
      name: domain.name,
      key: domain.key,
      organizationId: domain.organizationId
        ? new Types.ObjectId(domain.organizationId)
        : null,
      permissions: domain.permissions.map((p) => new Types.ObjectId(p)),
      isSystem: domain.isSystem,
    };
  }
}
