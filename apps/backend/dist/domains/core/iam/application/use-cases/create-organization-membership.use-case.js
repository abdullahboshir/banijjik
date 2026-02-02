import { OrganizationMembership, } from "@iam/domain";
import crypto from "crypto";
export class CreateOrganizationMembershipUseCase {
    constructor(membershipRepository) {
        this.membershipRepository = membershipRepository;
    }
    async execute(dto) {
        const membership = OrganizationMembership.create({
            membershipId: crypto.randomUUID(),
            userId: dto.userId,
            organizationId: dto.organizationId,
            roleId: dto.roleId,
            type: dto.type,
            status: dto.status,
            source: dto.source,
            designation: dto.designation,
            metadata: dto.metadata || {},
            joinedAt: new Date(),
        });
        // 5. Persistence
        return await this.membershipRepository.save(membership);
    }
}
//# sourceMappingURL=create-organization-membership.use-case.js.map