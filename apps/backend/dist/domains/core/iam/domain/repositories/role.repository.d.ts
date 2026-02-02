import { Role } from "@iam/domain";
export interface IRoleRepository {
    save(role: Role): Promise<void>;
    findById(roleId: string): Promise<Role | null>;
    findByKey(key: string, organizationId?: string): Promise<Role | null>;
    findByOrganization(organizationId: string): Promise<Role[]>;
    delete(roleId: string): Promise<void>;
}
//# sourceMappingURL=role.repository.d.ts.map