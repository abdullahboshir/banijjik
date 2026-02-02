import { Permission } from "@iam/domain";
export class PermissionMapper {
    static toDomain(doc) {
        return Permission.create({
            permissionId: doc.permissionId,
            domain: doc.domain,
            resource: doc.resource,
            action: doc.action,
            scope: doc.scope,
            effect: doc.effect,
            description: doc.description,
            isActive: doc.isActive,
        });
    }
    static toPersistence(domain) {
        const props = domain.toObject();
        return {
            permissionId: props.permissionId,
            domain: props.domain,
            resource: props.resource,
            action: props.action,
            scope: props.scope,
            effect: props.effect,
            description: props.description,
            isActive: props.isActive,
        };
    }
}
//# sourceMappingURL=permission.mapper.js.map