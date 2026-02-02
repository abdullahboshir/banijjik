import { Role } from "@iam/domain";
export class RoleMapper {
    static toDomain(doc) {
        return Role.create({
            roleId: doc.roleId,
            name: doc.name,
            key: doc.key,
            organizationId: doc.organizationId,
            permissions: doc.permissions,
            isSystem: doc.isSystem,
        });
    }
    static toPersistence(domain) {
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
//# sourceMappingURL=role.mapper.js.map