import { User } from "../entities";
export interface IUserRepository {
    save(user: User): Promise<User>;
    findById(userId: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    update(user: User): Promise<void>;
}
//# sourceMappingURL=user.repository.d.ts.map