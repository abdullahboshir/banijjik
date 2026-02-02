import { IPermissionRepository, Permission } from "@iam/domain";
export declare class MongoosePermissionRepository implements IPermissionRepository {
    save(permission: Permission): Promise<void>;
    findById(permissionId: string): Promise<Permission | null>;
    findByKey(key: string): Promise<Permission | null>;
    findAll(): Promise<Permission[]>;
    delete(permissionId: string): Promise<void>;
}
//# sourceMappingURL=permission.repository.impl.d.ts.map