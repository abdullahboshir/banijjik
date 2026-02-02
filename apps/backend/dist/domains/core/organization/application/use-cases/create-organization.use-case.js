import { Organization } from "../../domain/entities/organization.entity";
import { makeSlug } from "@banijjik/shared-kernel";
import { ORGANIZATION_STATUS, ORGANIZATION_STORAGE_PROVIDER, } from "@banijjik/contracts";
import { appConfig } from "../../../../../config/app.config";
import { OrganizationIndustry } from "../../domain/value-objects/industry.vo.js";
import { OrganizationLegal } from "../../domain/value-objects/legal-type.vo.js";
import { OrganizationNature } from "../../domain/value-objects/nature.vo.js";
import { OrganizationStatus } from "../../domain/value-objects/status.vo.js";
import { OrganizationLocalization } from "../../domain/value-objects/localization.vo.js";
import { OrganizationDeployment } from "../../domain/value-objects/deployment.vo.js";
export class CreateOrganizationUseCase {
    constructor(organizationRepository, iamService, mailService) {
        this.organizationRepository = organizationRepository;
        this.iamService = iamService;
        this.mailService = mailService;
    }
    async execute(dto) {
        let slug = makeSlug(dto.name);
        let counter = 0;
        while (true) {
            const candidate = counter === 0 ? slug : `${slug}-${counter}`;
            const exists = await this.organizationRepository.findBySlug(candidate);
            if (!exists) {
                slug = candidate;
                break;
            }
            counter++;
        }
        // 2. Create Organization Entity
        const organization = new Organization({
            name: dto.name,
            slug: slug,
            email: dto.email,
            phone: dto.phone,
            supportPhone: dto.supportPhone,
            website: dto.website,
            address: dto.address,
            establishedDate: dto.establishedDate,
            industry: OrganizationIndustry.create(dto.industry),
            legalType: OrganizationLegal.create(dto.legalType),
            nature: OrganizationNature.create(dto.nature),
            status: OrganizationStatus.create(ORGANIZATION_STATUS.ACTIVE),
            localization: OrganizationLocalization.create({
                currency: dto.currency,
                language: "en",
                timezone: "Asia/Dhaka",
                dateFormat: "DD/MM/YYYY",
            }),
            deployment: OrganizationDeployment.create({
                type: OrganizationDeployment.VALUE.SHARED,
                storageConfig: {
                    provider: ORGANIZATION_STORAGE_PROVIDER.LOCAL,
                },
            }),
            metadata: {},
        });
        // 3. Persistence
        const savedOrg = await this.organizationRepository.save(organization);
        if (!savedOrg.organizationId) {
            throw new Error("Failed to retrieve MongoDB ID for the created organization.");
        }
        // 4. Register Owner in IAM
        const iamResult = await this.iamService.registerOrganizationOwner({
            email: dto.email,
            firstName: dto.ownerFirstName,
            lastName: dto.ownerLastName,
            phone: dto.phone,
            organizationId: savedOrg.organizationId,
        });
        // 5. Send Invitation Email
        const setupUrl = `${appConfig.frontend_url}/auth/setup-password?token=${iamResult.token}&email=${dto.email}`;
        await this.mailService.sendWelcomeEmail(dto.email, `${dto.ownerFirstName} ${dto.ownerLastName}`, setupUrl);
        return {
            organizationId: organization.organizationId,
            ownerId: iamResult.userId,
            slug: organization.slug,
            message: "Organization created and invitation sent.",
        };
    }
}
//# sourceMappingURL=create-organization.use-case.js.map