import { IPermissionRepository, Permission } from "@iam/domain";
import { PermissionModel } from "../models/permission.model";
import { PermissionMapper } from "../mappers/permission.mapper";

export class MongoosePermissionRepository implements IPermissionRepository {
  async save(permission: Permission): Promise<void> {
    const data = PermissionMapper.toPersistence(permission);
    if (permission.permissionId) {
      await PermissionModel.findOneAndUpdate(
        { permissionId: permission.permissionId },
        data,
        { upsert: true },
      );
    } else {
      await PermissionModel.create(data);
    }
  }

  async findById(permissionId: string): Promise<Permission | null> {
    const doc = await PermissionModel.findOne({ permissionId });
    if (!doc) return null;
    return PermissionMapper.toDomain(doc as any);
  }

  async findByKey(key: string): Promise<Permission | null> {
    const doc = await PermissionModel.findOne({ key });
    if (!doc) return null;
    return PermissionMapper.toDomain(doc as any);
  }

  async findAll(): Promise<Permission[]> {
    const docs = await PermissionModel.find();
    return docs.map((doc) => PermissionMapper.toDomain(doc as any));
  }

  async delete(permissionId: string): Promise<void> {
    await PermissionModel.findOneAndDelete({ permissionId });
  }
}
