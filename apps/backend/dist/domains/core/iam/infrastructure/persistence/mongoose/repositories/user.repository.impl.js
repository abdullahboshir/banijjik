import { UserModel } from "../models/user.model";
import { UserPersistenceMapper } from "../mappers/user.mapper";
export class MongooseUserRepository {
    async save(user) {
        const data = UserPersistenceMapper.toPersistence(user);
        await UserModel.create(data);
    }
    async findById(id) {
        const doc = await UserModel.findById(id);
        if (!doc)
            return null;
        return UserPersistenceMapper.toDomain(doc);
    }
    async findByEmail(email) {
        const doc = await UserModel.findOne({ email: email.toLowerCase() });
        if (!doc)
            return null;
        return UserPersistenceMapper.toDomain(doc);
    }
    async update(user) {
        const data = UserPersistenceMapper.toPersistence(user);
        await UserModel.findByIdAndUpdate(user.id, data);
    }
}
//# sourceMappingURL=user.repository.impl.js.map