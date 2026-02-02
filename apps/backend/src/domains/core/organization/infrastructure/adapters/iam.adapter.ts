import {
  IIamService,
  IOwnerCreationDetails,
} from "../../application/ports/iam.port";
import { CreateUserUseCase } from "../../../iam/application/use-cases/create-user.use-case";
import { PortalType } from "../../../iam/domain/value-objects/portal-type.vo.js";
import { IJwtService } from "../../../iam/application/ports/jwt.port";
import { RoleModel } from "../../../iam/infrastructure/persistence/mongoose/models/role.model";
import {
  USER_ROLE,
  USER_STATUS,
  MEMBERSHIP_TYPE,
  COMMON_STATUS,
  MEMBERSHIP_SOURCE,
} from "@banijjik/contracts";
import crypto from "crypto";
import { CreateOrganizationMembershipUseCase } from "../../../iam/application/use-cases/create-organization-membership.use-case";
import { CreatePersonUseCase } from "../../../person/application/use-cases/create-person.use-case";
import { CreateOrganizationOwnershipUseCase } from "../../application/use-cases/create-organization-ownership.use-case";

export class IamServiceAdapter implements IIamService {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly createMembershipUseCase: CreateOrganizationMembershipUseCase,
    private readonly createPersonUseCase: CreatePersonUseCase,
    private readonly createOwnershipUseCase: CreateOrganizationOwnershipUseCase,
    private readonly jwtService: IJwtService,
  ) {}

  async registerOrganizationOwner(
    details: IOwnerCreationDetails,
  ): Promise<{ userId: string; token: string }> {
    // 1. Find Organization Owner Role
    const ownerRole = await RoleModel.findOne({
      name: USER_ROLE.ORGANIZATION_OWNER,
    });
    if (!ownerRole) {
      throw new Error(
        "Organization Owner role not found in system. Please run seeders.",
      );
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
    console.log(
      `   Creating Membership: User=${user.userId}, Org=${details.organizationId}, Role=${ownerRole.roleId}`,
    );
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
    console.log("   ✅ Organization Membership created successfully for Owner");

    // 5. Create Person Profile (Organization Owner Profile)
    await this.createPersonUseCase.execute({
      userId: user.userId,
      firstName: details.firstName,
      lastName: details.lastName,
      email: details.email,
      phone: details.phone,
      designation: "Organization Owner",
    });
    console.log("   ✅ Person Profile created for Owner");

    // 6. Create Organization Ownership (Legal/Billing Record)
    await this.createOwnershipUseCase.execute({
      organizationId: details.organizationId,
      userId: user.userId,
      billingEmail: details.email,
      billingPhone: details.phone,
    });
    console.log("   ✅ Organization Ownership created");

    // 7. Generate Setup Token
    const token = this.jwtService.generateToken({
      userId: user.userId,
      email: user.email,
      type: "SETUP_PASSWORD",
      organizationId: details.organizationId,
    });

    return { userId: user.userId, token };
  }
}
