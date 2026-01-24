import { User, IUserRepository, UniqueEmailPolicy, PasswordStrengthPolicy, Email, Password, UserName, Phone, EmailAlreadyExistsError, PasswordTooWeakError } from '@identity/domain';
import { CreateUserDto, UserResponseDto } from '../dto';
import { IPasswordHasher } from '../ports';

export class CreateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly uniqueEmailPolicy: UniqueEmailPolicy,
    private readonly passwordStrengthPolicy: PasswordStrengthPolicy
  ) {}

  async execute(dto: CreateUserDto): Promise<UserResponseDto> {
    // 1. Business Policy: Check if email already exists
    const isUnique = await this.uniqueEmailPolicy.isSatisfiedBy(dto.email);
    if (!isUnique) {
      throw new EmailAlreadyExistsError(dto.email);
    }

    // 2. Business Policy: Password strength check (Secondary domain level check)
    if (!this.passwordStrengthPolicy.isSatisfiedBy(dto.password)) {
      throw new PasswordTooWeakError(this.passwordStrengthPolicy.getErrorMessage());
    }

    // 3. Create Value Objects (Validation & Logic)
    const email = Email.create(dto.email);
    const passwordVO = Password.create(dto.password);
    const name = UserName.create(dto.name.firstName, dto.name.lastName);
    const phone = Phone.createOptional(dto.phone);

    // 4. Security: Hash Password
    const hashedPassword = await this.passwordHasher.hash(passwordVO.toString());

    // 5. Instantiate Domain Entity
    const user = new User(
      crypto.randomUUID(),
      name.toObject() as any,
      email.toString(),
      phone ? phone.toString() : null,
      hashedPassword,
      dto.needsPasswordChange ?? false,
      null,
      dto.isEmailVerified ?? false,
      dto.isPhoneVerified ?? false,
      dto.status ?? 'PENDING' as any,
      dto.isActive ?? true,
      false, // isDeleted
      dto.isSuperAdmin ?? false,
      dto.globalRoles ?? [],
      dto.directPermissions ?? [],
      dto.businessAccess ?? [],
      null, // lastLogin
      [], // loginHistory
      dto.settings ?? { theme: 'system', tableHeight: 'medium' },
      dto.metadata ?? {},
      dto.organization,
      dto.region
    );

    // 6. Persistence
    await this.userRepository.save(user);

    // 7. Return Response DTO
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      status: user.status,
      isActive: user.isActive,
      isSuperAdmin: user.isSuperAdmin,
      globalRoles: user.globalRoles,
      directPermissions: user.directPermissions,
      businessAccess: user.businessAccess,
      lastLogin: user.lastLogin,
      loginHistory: user.loginHistory,
      settings: user.settings,
      organization: user.organization,
      region: user.region,
      createdAt: user.createdAt,
    };
  }
}
