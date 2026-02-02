import { RoleModel } from "../models/role.model";
import { RoleMapper } from "../mappers/role.mapper";
export class MongooseRoleRepository {
    async save(role) {
        const data = RoleMapper.toPersistence(role);
        if (role.roleId) {
            await RoleModel.findByIdAndUpdate(role.roleId, data);
        }
        else {
            await RoleModel.create(data);
        }
    }
    async findById(roleId) {
        const doc = await RoleModel.findById(roleId).populate("permissions");
        if (!doc)
            return null;
        return RoleMapper.toDomain(doc);
    }
    async findByKey(key, organizationId) {
        const doc = await RoleModel.findOne({
            key,
            organizationId: organizationId || null,
        }).populate("permissions");
        if (!doc)
            return null;
        return RoleMapper.toDomain(doc);
    }
    async findByOrganization(organizationId) {
        const docs = await RoleModel.find({
            $or: [{ organizationId }, { organizationId: null }],
        }).populate("permissions");
        return docs.map((doc) => RoleMapper.toDomain(doc));
    }
    async delete(roleId) {
        await RoleModel.findByIdAndDelete(roleId);
    }
}
//# sourceMappingURL=role.repository.impl.js.map