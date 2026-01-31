import { Request, Response } from "express";
import { JoinOrganizationUseCase } from "@person/application";
export declare class PersonController {
    private readonly joinOrgUseCase;
    constructor(joinOrgUseCase: JoinOrganizationUseCase);
    joinOrganization(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=person.controller.d.ts.map