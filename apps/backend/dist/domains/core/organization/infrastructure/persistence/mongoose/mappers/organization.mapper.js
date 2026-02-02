import { OrganizationIndustry } from "../../../../domain/value-objects/industry.vo.js";
import { OrganizationLegal } from "../../../../domain/value-objects/legal-type.vo.js";
import { OrganizationNature } from "../../../../domain/value-objects/nature.vo.js";
import { OrganizationStatus } from "../../../../domain/value-objects/status.vo.js";
import { OrganizationLocalization } from "../../../../domain/value-objects/localization.vo.js";
import { OrganizationDeployment } from "../../../../domain/value-objects/deployment.vo.js";
import { Organization } from "../../../../domain/entities/organization.entity";
export class OrganizationMapper {
    static toDomain(raw) {
        return new Organization({
            organizationId: raw.organizationId,
            name: raw.name,
            slug: raw.slug,
            // Instantiate VOs
            industry: OrganizationIndustry.create(raw.industry),
            legalType: OrganizationLegal.create(raw.legalType),
            nature: OrganizationNature.create(raw.nature),
            status: OrganizationStatus.create(raw.status),
            localization: OrganizationLocalization.create(raw.localization),
            deployment: OrganizationDeployment.create(raw.deployment),
            email: raw.email,
            phone: raw.phone,
            supportPhone: raw.supportPhone,
            website: raw.website,
            address: raw.address,
            establishedDate: raw.establishedDate,
            metadata: raw.metadata,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
        });
    }
    static toPersistence(organization) {
        const json = organization.toJSON();
        return {
            organizationId: json.organizationId,
            name: json.name,
            slug: json.slug,
            industry: json.industry,
            legalType: json.legalType,
            nature: json.nature,
            status: json.status,
            email: json.email,
            phone: json.phone,
            supportPhone: json.supportPhone,
            website: json.website,
            address: json.address,
            establishedDate: json.establishedDate,
            localization: json.localization,
            deployment: json.deployment,
            metadata: json.metadata,
        };
    }
}
//# sourceMappingURL=organization.mapper.js.map