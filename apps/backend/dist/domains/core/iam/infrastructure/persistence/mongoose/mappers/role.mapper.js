import { Types } from "mongoose";
import { Role } from "@iam/domain";
export class RoleMapper {
    static toDomain(doc) {
        return Role.create({
            id: doc._id.toString(),
            name: doc.name,
            key: doc.key,
            organizationId: doc.organizationId?.toString(),
            permissions: doc.permissions.map((p) => p.toString()),
            isSystem: doc.isSystem,
        });
    }
    static toPersistence(domain) {
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
//# sourceMappingURL=role.mapper.js.map