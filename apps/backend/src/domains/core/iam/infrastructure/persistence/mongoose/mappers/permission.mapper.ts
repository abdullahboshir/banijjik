import { Permission } from "@iam/domain";
import { IPermissionDoc } from "../models/permission.model";

export class PermissionMapper {
  static toDomain(doc: IPermissionDoc): Permission {
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

  static toPersistence(domain: Permission): any {
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
