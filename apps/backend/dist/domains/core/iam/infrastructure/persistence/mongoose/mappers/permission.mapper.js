import { Permission } from "@iam/domain";
export class PermissionMapper {
    static toDomain(doc) {
        return Permission.create({
            id: doc._id.toString(),
            name: doc.name,
            key: doc.key,
            module: doc.module,
            description: doc.description,
        });
    }
    static toPersistence(domain) {
        return {
            name: domain.name,
            key: domain.key,
            module: domain.module,
            description: domain.toObject().description,
        };
    }
}
//# sourceMappingURL=permission.mapper.js.map