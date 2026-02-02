import { Request, Response } from "express";
import { CreateOrganizationUseCase } from "../../application/use-cases/create-organization.use-case";
export declare class OrganizationController {
    private readonly createOrganizationUseCase;
    constructor(createOrganizationUseCase: CreateOrganizationUseCase);
    create(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=organization.controller.d.ts.map