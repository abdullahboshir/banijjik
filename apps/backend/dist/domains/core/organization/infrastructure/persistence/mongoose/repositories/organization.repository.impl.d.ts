import { Organization } from "../../../../domain/entities/organization.entity";
import { IOrganizationRepository } from "../../../../domain/repositories/organization.repository";
export declare class MongooseOrganizationRepository implements IOrganizationRepository {
    save(organization: Organization): Promise<Organization>;
    findById(organizationId: string): Promise<Organization | null>;
    findBySlug(slug: string): Promise<Organization | null>;
}
//# sourceMappingURL=organization.repository.impl.d.ts.map