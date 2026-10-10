import { asId, type UserId } from "@banijjik/ids";
import { stripMongoInternals } from "../../../../kernel/db/index.js";
import { Role } from "../domain/role.entity.js";
import type { RoleDocument } from "./role.schema.js";

export function toRoleDocument(role: Role): RoleDocument {
  return {
    roleId: role.roleId,
    organizationId: role.organizationId,
    roleKey: role.roleKey,
    nameKey: role.nameKey,
    isSystem: role.isSystem,
    permissionKeys: [...role.permissionKeys],
    version: role.version,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    createdByUserId: role.createdByUserId,
    updatedByUserId: null,
  };
}

export function toRole(document: RoleDocument): Role {
  const stored = stripMongoInternals(document);
  return Role.restore({
    roleId: asId(stored.roleId),
    organizationId: asId(stored.organizationId),
    roleKey: stored.roleKey,
    nameKey: stored.nameKey,
    isSystem: stored.isSystem,
    permissionKeys: stored.permissionKeys,
    version: stored.version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    createdByUserId: stored.createdByUserId === null ? null : asId<UserId>(stored.createdByUserId),
  });
}
