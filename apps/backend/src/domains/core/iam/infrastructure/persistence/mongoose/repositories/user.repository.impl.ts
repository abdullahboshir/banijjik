import { IUserRepository, User } from "@iam/domain";
import { UserModel } from "../models/user.model";
import { UserPersistenceMapper } from "../mappers/user.mapper";

export class MongooseUserRepository implements IUserRepository {
  async save(user: User): Promise<User> {
    const data = UserPersistenceMapper.toPersistence(user);
    const doc = await UserModel.findOneAndUpdate(
      { userId: user.userId },
      data,
      {
        upsert: true,
        new: true,
      },
    );
    return UserPersistenceMapper.toDomain(doc);
  }

  async findById(userId: string): Promise<User | null> {
    const doc = await UserModel.findOne({ userId });
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
    await UserModel.findOneAndUpdate({ userId: user.userId }, data);
  }
}
