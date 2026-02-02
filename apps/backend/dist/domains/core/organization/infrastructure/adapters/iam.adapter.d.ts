import { IIamService, IOwnerCreationDetails } from "../../application/ports/iam.port";
import { CreateUserUseCase } from "../../../iam/application/use-cases/create-user.use-case";
import { IJwtService } from "../../../iam/application/ports/jwt.port";
import { CreateOrganizationMembershipUseCase } from "../../../iam/application/use-cases/create-organization-membership.use-case";
export declare class IamServiceAdapter implements IIamService {
    private readonly createUserUseCase;
    private readonly createMembershipUseCase;
    private readonly jwtService;
    constructor(createUserUseCase: CreateUserUseCase, createMembershipUseCase: CreateOrganizationMembershipUseCase, jwtService: IJwtService);
    registerOrganizationOwner(details: IOwnerCreationDetails): Promise<{
        userId: string;
        token: string;
    }>;
}
//# sourceMappingURL=iam.adapter.d.ts.map