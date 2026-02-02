import { PermissionModel } from "../models/permission.model";
import { PermissionMapper } from "../mappers/permission.mapper";
export class MongoosePermissionRepository {
    async save(permission) {
        const data = PermissionMapper.toPersistence(permission);
        if (permission.permissionId) {
            await PermissionModel.findByIdAndUpdate(permission.permissionId, data);
        }
        else {
            await PermissionModel.create(data);
        }
    }
    async findById(permissionId) {
        const doc = await PermissionModel.findById(permissionId);
        if (!doc)
            return null;
        return PermissionMapper.toDomain(doc);
    }
    async findByKey(key) {
        const doc = await PermissionModel.findOne({ key });
        if (!doc)
            return null;
        return PermissionMapper.toDomain(doc);
    }
    async findAll() {
        const docs = await PermissionModel.find();
        return docs.map((doc) => PermissionMapper.toDomain(doc));
    }
    async delete(permissionId) {
        await PermissionModel.findByIdAndDelete(permissionId);
    }
}
//# sourceMappingURL=permission.repository.impl.js.map