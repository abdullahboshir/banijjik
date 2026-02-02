import {
  User,
  IUserRepository,
  UniqueEmailPolicy,
  PasswordStrengthPolicy,
  Email,
  Password,
  UserName,
  Phone,
  UserStatus,
  EmailAlreadyExistsError,
  PasswordTooWeakError,
  OrganizationMembershipVO,
  DirectPermission,
  UserSettings,
  PortalType,
} from "@iam/domain";
import { CreateUserDto } from "../dto";
import { IPasswordHasher } from "../ports";
import {
  UserResponseDto,
  IDirectPermission,
  IOrganizationMembership,
  IUserDetail,
  ILoginHistory,
  PermissionEffectType,
  UserThemeType,
  USER_THEME,
  TABLE_HEIGHT,
} from "@banijjik/contracts";

export class CreateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly uniqueEmailPolicy: UniqueEmailPolicy,
    private readonly passwordStrengthPolicy: PasswordStrengthPolicy,
  ) {}

  async execute(dto: CreateUserDto): Promise<UserResponseDto> {
    // 1. Business Policy: Check if email already exists
    const isUnique = await this.uniqueEmailPolicy.isSatisfiedBy(dto.email);
    if (!isUnique) {
      throw new EmailAlreadyExistsError(dto.email);
    }

    // 2. Business Policy: Password strength check (Secondary domain level check)
    if (!this.passwordStrengthPolicy.isSatisfiedBy(dto.password)) {
      throw new PasswordTooWeakError(
        this.passwordStrengthPolicy.getErrorMessage(),
      );
    }

    // 3. Create Value Objects (Validation & Logic)
    const email = Email.create(dto.email);
    const passwordVO = Password.create(dto.password);
    const name = UserName.create(dto.name.firstName, dto.name.lastName);
    const phone = Phone.createOptional(dto.phone);
    // Use factory for status defaulting
    const status = dto.status
      ? UserStatus.from(dto.status)
      : UserStatus.VALUE.PENDING;

    // Create array VOs
    const directPermissions = (dto.directPermissions || []).map(
      (p: IDirectPermission) =>
        DirectPermission.create({
          permissionId: p.permissionId,
          effect: p.effect as PermissionEffectType,
        }),
    );
    const organizationMembership = (dto.organizationMembership || []).map(
      (b: IOrganizationMembership) =>
        OrganizationMembershipVO.create({
          role: b.role,
          organization: b.organization,
          status: b.status,
        }),
    );

    // Create Settings VO
    const settingsDTO = dto.settings || {
      theme: USER_THEME.SYSTEM,
      tableHeight: TABLE_HEIGHT.MEDIUM,
    };
    const settings = UserSettings.create({
      theme: settingsDTO.theme as UserThemeType,
      tableHeight: settingsDTO.tableHeight,
    });

    // 4. Security: Hash Password
    const hashedPassword = await this.passwordHasher.hash(
      passwordVO.toString(),
    );

    // 5. Instantiate Domain Entity
    const user = new User(
      crypto.randomUUID(), // userId
      name,
      email,
      phone,
      hashedPassword,
      dto.needsPasswordChange ?? false,
      null,
      dto.isEmailVerified ?? false,
      dto.isPhoneVerified ?? false,
      status,
      dto.isActive ?? true,
      false, // isDeleted
      dto.isSuperAdmin ?? false,
      dto.systemRoles ?? [],
      directPermissions,
      null, // lastLogin
      {
        portal: dto.lastActiveContext?.portal || PortalType.VALUE.PLATFORM,
        organizationId: dto.lastActiveContext?.organizationId,
        lastAccessedAt: new Date(),
      },
      [], // loginHistory
      settings,
      dto.metadata ?? {},
      // creating user directly in domain doesn't set organization/region at top level anymore
    );

    // 6. Persistence
    await this.userRepository.save(user);

    // 7. Return Response DTO
    return {
      userId: user.userId,
      name: user.name.toObject(),
      email: user.email.toString(),
      phone: user.phone ? user.phone.toString() : null,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      status: user.status.getValue(),
      isActive: user.isActive,
      isSuperAdmin: user.isSuperAdmin,
      systemRoles: user.systemRoles,
      directPermissions: user.directPermissions.map(
        (p) => p.toObject() as IDirectPermission,
      ),
      organizationMembership: [], // Will be created via Membership service separately
      lastLogin: user.lastLogin,
      loginHistory: user.loginHistory.map((h) => {
        const obj = h.toObject();
        return { ...obj, date: obj.timestamp } as unknown as ILoginHistory;
      }),
      settings: user.settings.toObject() as IUserDetail,
      lastActiveContext: user.lastActiveContext,
      createdAt: user.createdAt,
    };
  }
}
