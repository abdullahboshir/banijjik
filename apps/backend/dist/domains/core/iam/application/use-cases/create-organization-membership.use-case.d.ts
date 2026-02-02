import { IOrganizationMembershipRepository } from "@iam/domain";
import { CreateOrganizationMembershipDto } from "../dto/membership.dto";
export declare class CreateOrganizationMembershipUseCase {
    private readonly membershipRepository;
    constructor(membershipRepository: IOrganizationMembershipRepository);
    execute(dto: CreateOrganizationMembershipDto): Promise<any>;
}
//# sourceMappingURL=create-organization-membership.use-case.d.ts.map