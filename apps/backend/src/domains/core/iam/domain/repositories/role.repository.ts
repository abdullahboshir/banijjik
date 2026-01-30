import { Role } from "@iam/domain";

export interface IRoleRepository {
  save(role: Role): Promise<void>;
  findById(id: string): Promise<Role | null>;
  findByKey(key: string, organizationId?: string): Promise<Role | null>;
  findByOrganization(organizationId: string): Promise<Role[]>;
  delete(id: string): Promise<void>;
}
