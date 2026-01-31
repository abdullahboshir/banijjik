import { Role } from "@iam/domain";
import { IRoleDoc } from "../models/role.model";
export declare class RoleMapper {
    static toDomain(doc: IRoleDoc): Role;
    static toPersistence(domain: Role): any;
}
//# sourceMappingURL=role.mapper.d.ts.map