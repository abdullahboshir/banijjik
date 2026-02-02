import { PortalType } from "../../../iam/domain/value-objects/portal-type.vo.js";
import { RoleModel } from "../../../iam/infrastructure/persistence/mongoose/models/role.model";
import { USER_ROLE, USER_STATUS, MEMBERSHIP_TYPE, COMMON_STATUS, MEMBERSHIP_SOURCE, } from "@banijjik/contracts";
import crypto from "crypto";
export class IamServiceAdapter {
    constructor(createUserUseCase, createMembershipUseCase, jwtService) {
        this.createUserUseCase = createUserUseCase;
        this.createMembershipUseCase = createMembershipUseCase;
        this.jwtService = jwtService;
    }
    async registerOrganizationOwner(details) {
        // 1. Find Organization Owner Role
        const ownerRole = await RoleModel.findOne({
            name: USER_ROLE.ORGANIZATION_OWNER,
        });
        if (!ownerRole) {
            throw new Error("Organization Owner role not found in system. Please run seeders.");
        }
        // 2. Generate Temporary Password (Random)
        const tempPassword = crypto.randomBytes(16).toString("hex") + "1A@";
        // 3. Create User via IAM UseCase
        const user = await this.createUserUseCase.execute({
            name: {
                firstName: details.firstName,
                lastName: details.lastName,
            },
            email: details.email,
            phone: details.phone,
            password: tempPassword,
            status: USER_STATUS.PENDING, // User created as pending
            isActive: true,
            systemRoles: [ownerRole.roleId], // Assign Owner Role using roleId
            isSuperAdmin: false,
            directPermissions: [],
            organizationMembership: [],
            isEmailVerified: false,
            isPhoneVerified: false,
            needsPasswordChange: true,
            metadata: {
                organizationId: details.organizationId,
            },
            lastActiveContext: {
                portal: PortalType.VALUE.ORGANIZATION,
                organizationId: details.organizationId,
            },
        });
        // 4. Create Organization Membership (Link User to Org)
        // Using domain String IDs for relations (Hybrid ID Strategy)
        await this.createMembershipUseCase.execute({
            userId: user.userId,
            organizationId: details.organizationId,
            roleId: ownerRole.roleId,
            type: MEMBERSHIP_TYPE.STAFF,
            status: COMMON_STATUS.ACTIVE,
            source: MEMBERSHIP_SOURCE.WEB_PORTAL,
            designation: "Organization Owner",
        });
        // 5. Generate Setup Token
        const token = this.jwtService.generateToken({
            userId: user.userId,
            email: user.email,
            type: "SETUP_PASSWORD",
            organizationId: details.organizationId,
        });
        return { userId: user.userId, token };
    }
}
//# sourceMappingURL=iam.adapter.js.map