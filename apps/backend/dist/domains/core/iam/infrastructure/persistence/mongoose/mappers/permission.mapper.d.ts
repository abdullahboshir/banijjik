import { Permission } from "@iam/domain";
import { IPermissionDoc } from "../models/permission.model";
export declare class PermissionMapper {
    static toDomain(doc: IPermissionDoc): Permission;
    static toPersistence(domain: Permission): any;
}
//# sourceMappingURL=permission.mapper.d.ts.map