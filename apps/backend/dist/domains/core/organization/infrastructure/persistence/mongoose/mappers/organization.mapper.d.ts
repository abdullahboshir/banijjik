import { Organization } from "../../../../domain/entities/organization.entity";
import { IOrganizationDocument } from "../models/organization.model";
export declare class OrganizationMapper {
    static toDomain(raw: IOrganizationDocument): Organization;
    static toPersistence(organization: Organization): any;
}
//# sourceMappingURL=organization.mapper.d.ts.map