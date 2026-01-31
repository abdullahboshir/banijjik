import { User } from "@iam/domain";
import { IUserDocument } from "../models/user.model";
export declare class UserPersistenceMapper {
    /**
     * Domain Entity -> Mongoose Document (Persistence)
     */
    static toPersistence(user: User): any;
    /**
     * Mongoose Document -> Domain Entity
     */
    static toDomain(doc: IUserDocument): User;
}
//# sourceMappingURL=user.mapper.d.ts.map