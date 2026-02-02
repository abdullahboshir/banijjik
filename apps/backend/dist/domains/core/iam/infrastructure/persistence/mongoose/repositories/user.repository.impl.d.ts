import { IUserRepository, User } from "@iam/domain";
export declare class MongooseUserRepository implements IUserRepository {
    save(user: User): Promise<User>;
    findById(userId: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    update(user: User): Promise<void>;
}
//# sourceMappingURL=user.repository.impl.d.ts.map