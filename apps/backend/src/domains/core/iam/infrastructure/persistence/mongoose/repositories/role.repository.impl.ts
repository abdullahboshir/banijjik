import { IRoleRepository, Role } from "@iam/domain";
import { RoleModel } from "../models/role.model";
import { RoleMapper } from "../mappers/role.mapper";

export class MongooseRoleRepository implements IRoleRepository {
  async save(role: Role): Promise<void> {
    const data = RoleMapper.toPersistence(role);
    if (role.id) {
      await RoleModel.findByIdAndUpdate(role.id, data);
    } else {
      await RoleModel.create(data);
    }
  }

  async findById(id: string): Promise<Role | null> {
    const doc = await RoleModel.findById(id).populate("permissions");
    if (!doc) return null;
    return RoleMapper.toDomain(doc as any);
  }

  async findByKey(key: string, organizationId?: string): Promise<Role | null> {
    const doc = await RoleModel.findOne({
      key,
      organizationId: organizationId || null,
    }).populate("permissions");
    if (!doc) return null;
    return RoleMapper.toDomain(doc as any);
  }

  async findByOrganization(organizationId: string): Promise<Role[]> {
    const docs = await RoleModel.find({
      $or: [{ organizationId }, { organizationId: null }],
    }).populate("permissions");
    return docs.map((doc) => RoleMapper.toDomain(doc as any));
  }

  async delete(id: string): Promise<void> {
    await RoleModel.findByIdAndDelete(id);
  }
}
