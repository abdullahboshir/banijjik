import { CreateUserUseCase } from '../use-cases';
import { CreateUserDto, UserResponseDto } from '../dto';

export class RegisterUserHandler {
  constructor(private readonly createUserUseCase: CreateUserUseCase) {}

  /**
   * Orchestrates the registration process.
   * In the future, this can handle multi-step registrations, 
   * multiple use-case coordination, and transaction management.
   */
  async handle(dto: CreateUserDto): Promise<UserResponseDto> {
    // For now, it delegates to the use case, but provides the orchestration boundary.
    // In a complex system, this might coordinate with Organization registration, Billing setup, etc.
    return await this.createUserUseCase.execute(dto);
  }
}
