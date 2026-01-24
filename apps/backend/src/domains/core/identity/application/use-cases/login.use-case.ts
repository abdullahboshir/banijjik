import { LoginDto, LoginResponseDto } from '../dto';
import { IUserRepository, InvalidCredentialsError } from '@identity/domain';
import { IPasswordHasher, IJwtService } from '../ports';

export class LoginUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly jwtService: IJwtService
  ) {}

  async execute(dto: LoginDto): Promise<LoginResponseDto> {
    // 1. Find User
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    // 2. Check if user is eligible to login (Domain Logic in Entity)
    if (!user.canLogin()) {
      throw new Error('validation.user.account_disabled');
    }

    // 3. Verify Password
    const isPasswordValid = await this.passwordHasher.compare(dto.password, user.getPassword() || '');
    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    // 4. Generate Token
    const accessToken = this.jwtService.generateToken({
      sub: user.id,
      email: user.email,
      roles: user.globalRoles,
    });

    // 5. Return Response
    return {
      accessToken,
      user: {
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
      },
    };
  }
}
