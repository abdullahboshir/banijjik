import { Permission } from "@iam/domain";
export interface IPermissionRepository {
    save(permission: Permission): Promise<void>;
    findById(permissionId: string): Promise<Permission | null>;
    findByKey(key: string): Promise<Permission | null>;
    findAll(): Promise<Permission[]>;
    delete(permissionId: string): Promise<void>;
}
//# sourceMappingURL=permission.repository.d.ts.map