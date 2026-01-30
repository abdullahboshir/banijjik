import { Permission } from "@iam/domain";

export interface IPermissionRepository {
  save(permission: Permission): Promise<void>;
  findById(id: string): Promise<Permission | null>;
  findByKey(key: string): Promise<Permission | null>;
  findAll(): Promise<Permission[]>;
  delete(id: string): Promise<void>;
}
