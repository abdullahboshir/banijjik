import { UserModel } from "../models/user.model";
import { UserPersistenceMapper } from "../mappers/user.mapper";
export class MongooseUserRepository {
    async save(user) {
        const data = UserPersistenceMapper.toPersistence(user);
        const doc = await UserModel.findOneAndUpdate({ userId: user.userId }, data, {
            upsert: true,
            new: true,
        });
        return UserPersistenceMapper.toDomain(doc);
    }
    async findById(userId) {
        const doc = await UserModel.findOne({ userId });
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
        await UserModel.findOneAndUpdate({ userId: user.userId }, data);
    }
}
//# sourceMappingURL=user.repository.impl.js.map