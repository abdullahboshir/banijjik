import { IUserRepository, User } from "@iam/domain";
import { UserModel } from "../models/user.model";
import { UserPersistenceMapper } from "../mappers/user.mapper";

export class MongooseUserRepository implements IUserRepository {
  async save(user: User): Promise<void> {
    const data = UserPersistenceMapper.toPersistence(user);
    await UserModel.create(data);
  }

  async findById(id: string): Promise<User | null> {
    const doc = await UserModel.findById(id);
    if (!doc) return null;
    return UserPersistenceMapper.toDomain(doc);
  }

  async findByEmail(email: string): Promise<User | null> {
    const doc = await UserModel.findOne({ email: email.toLowerCase() });
    if (!doc) return null;
    return UserPersistenceMapper.toDomain(doc);
  }

  async update(user: User): Promise<void> {
    const data = UserPersistenceMapper.toPersistence(user);
    await UserModel.findByIdAndUpdate(user.id, data);
  }
}
