import { LoginUseCase } from "../use-cases";
import { LoginDto } from "../dto";
import { LoginResponseDto } from "@banijjik/contracts";

export class LoginHandler {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  /**
   * Orchestrates the login process.
   */
  async handle(dto: LoginDto): Promise<LoginResponseDto> {
    return await this.loginUseCase.execute(dto);
  }
}
