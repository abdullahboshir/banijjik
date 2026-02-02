import { CreateUserSchema, LoginSchema } from "@banijjik/validation";
export class UserController {
    constructor(createUserUseCase, loginUseCase) {
        this.createUserUseCase = createUserUseCase;
        this.loginUseCase = loginUseCase;
    }
    async create(req, res) {
        try {
            const validatedData = CreateUserSchema.parse(req.body);
            const result = await this.createUserUseCase.execute(validatedData);
            res.status(201).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message || "Server Error",
            });
        }
    }
    async login(req, res) {
        try {
            const validatedData = LoginSchema.parse(req.body);
            const result = await this.loginUseCase.execute(validatedData);
            res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            res.status(401).json({
                success: false,
                error: error.message || "Unauthorized",
            });
        }
    }
}
//# sourceMappingURL=auth.controller.js.map