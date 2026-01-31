import { RoleModel } from "../models/role.model";
import { RoleMapper } from "../mappers/role.mapper";
export class MongooseRoleRepository {
    async save(role) {
        const data = RoleMapper.toPersistence(role);
        if (role.id) {
            await RoleModel.findByIdAndUpdate(role.id, data);
        }
        else {
            await RoleModel.create(data);
        }
    }
    async findById(id) {
        const doc = await RoleModel.findById(id).populate("permissions");
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
    async delete(id) {
        await RoleModel.findByIdAndDelete(id);
    }
}
//# sourceMappingURL=role.repository.impl.js.map