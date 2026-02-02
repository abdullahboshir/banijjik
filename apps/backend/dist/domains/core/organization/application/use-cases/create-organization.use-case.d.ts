import { IOrganizationRepository } from "../../domain/repositories/organization.repository";
import { CreateOrganizationDto } from "../dto/create-organization.dto";
import { IIamService } from "../ports/iam.port";
import { IMailService } from "../../../../../shared/application/ports/mail.port";
export declare class CreateOrganizationUseCase {
    private readonly organizationRepository;
    private readonly iamService;
    private readonly mailService;
    constructor(organizationRepository: IOrganizationRepository, iamService: IIamService, mailService: IMailService);
    execute(dto: CreateOrganizationDto): Promise<any>;
}
//# sourceMappingURL=create-organization.use-case.d.ts.map