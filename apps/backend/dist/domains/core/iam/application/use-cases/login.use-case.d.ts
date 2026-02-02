import { IUserRepository } from "../../domain/repositories/user.repository";
import { IPasswordHasher, IJwtService } from "../ports";
import { LoginDto } from "../dto";
export declare class LoginUseCase {
    private readonly userRepo;
    private readonly passwordService;
    private readonly jwtService;
    constructor(userRepo: IUserRepository, passwordService: IPasswordHasher, jwtService: IJwtService);
    execute(request: LoginDto): Promise<any>;
}
//# sourceMappingURL=login.use-case.d.ts.map