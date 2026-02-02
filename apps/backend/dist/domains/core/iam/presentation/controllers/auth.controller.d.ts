import { Request, Response } from "express";
import { CreateUserUseCase, LoginUseCase } from "@iam/application";
export declare class UserController {
    private readonly createUserUseCase;
    private readonly loginUseCase;
    constructor(createUserUseCase: CreateUserUseCase, loginUseCase: LoginUseCase);
    create(req: Request, res: Response): Promise<void>;
    login(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=auth.controller.d.ts.map