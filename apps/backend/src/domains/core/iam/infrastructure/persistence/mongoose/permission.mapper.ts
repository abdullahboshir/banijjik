import { Permission } from "@iam/domain";
import { IPermissionDoc } from "./permission.model";

export class PermissionMapper {
  static toDomain(doc: IPermissionDoc): Permission {
    return Permission.create({
      id: doc._id.toString(),
      name: doc.name,
      key: doc.key,
      module: doc.module,
      description: doc.description,
    });
  }

  static toPersistence(domain: Permission): any {
    return {
      name: domain.name,
      key: domain.key,
      module: domain.module,
      description: domain.toObject().description,
    };
  }
}
