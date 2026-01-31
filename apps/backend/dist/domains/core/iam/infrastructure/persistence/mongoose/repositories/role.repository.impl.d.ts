import { IRoleRepository, Role } from "@iam/domain";
export declare class MongooseRoleRepository implements IRoleRepository {
    save(role: Role): Promise<void>;
    findById(id: string): Promise<Role | null>;
    findByKey(key: string, organizationId?: string): Promise<Role | null>;
    findByOrganization(organizationId: string): Promise<Role[]>;
    delete(id: string): Promise<void>;
}
//# sourceMappingURL=role.repository.impl.d.ts.map