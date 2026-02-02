import { IUserRepository } from "../../domain/repositories/user.repository";
import { IPasswordHasher, IJwtService } from "../ports";
import { ValidationError } from "@shared";
import { LoginDto } from "../dto";

export class LoginUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly passwordService: IPasswordHasher,
    private readonly jwtService: IJwtService,
  ) {}

  async execute(request: LoginDto): Promise<any> {
    const user = await this.userRepo.findByEmail(request.email);
    if (!user) {
      throw new ValidationError("Invalid credentials");
    }

    if (!user.getPassword()) {
      throw new ValidationError("Invalid credentials");
    }

    const isMatch = await this.passwordService.compare(
      request.password,
      user.getPassword()!,
    );

    if (!isMatch) {
      throw new ValidationError("Password is not correct");
    }

    console.log(
      "before token",
      user?.userId,
      user?.email.toString(),
      user?.systemRoles[0],
    );
    const token = this.jwtService.generateToken({
      userId: user.userId,
      email: user.email.toString(),
      role: user.systemRoles[0] || "USER",
    });
    console.log("after token", token);
    return {
      token,
      user: {
        userId: user.userId,
        email: user.email.toString(),
        name: user.name.getFullName(),
        status: user.status.getValue(),
      },
    };
  }
}
