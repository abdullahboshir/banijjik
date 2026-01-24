import { LoginUseCase } from '../use-cases';
import { LoginDto, LoginResponseDto } from '../dto';

export class LoginHandler {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  /**
   * Orchestrates the login process.
   */
  async handle(dto: LoginDto): Promise<LoginResponseDto> {
    return await this.loginUseCase.execute(dto);
  }
}
