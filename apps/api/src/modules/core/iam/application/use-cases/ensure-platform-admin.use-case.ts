import type { UserId } from "@banijjik/ids";
import type { Clock } from "../../../../../kernel/time/index.js";
import { assertPasswordAcceptable, normalizePassword } from "../../domain/password-policy.js";
import { PlatformOperator } from "../../domain/platform-operator.entity.js";
import { normalizeEmail, User } from "../../domain/user.entity.js";
import type { PasswordHasher } from "../ports/password-hasher.js";
import type { PlatformOperatorRepository } from "../ports/platform-operator-repository.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";
import type { UserRepository } from "../ports/user-repository.js";

export interface EnsurePlatformAdminInput {
  readonly email: string;
  readonly password: string;
}

export interface EnsurePlatformAdminResult {
  readonly isUserCreated: boolean;
  readonly isOperatorCreated: boolean;
}

export interface EnsurePlatformAdminDependencies {
  readonly users: UserRepository;
  readonly operators: PlatformOperatorRepository;
  readonly hasher: PasswordHasher;
  readonly unitOfWork: UnitOfWork;
  readonly clock: Clock;
}

const SEEDED_ADMIN_NAME = "Platform Admin";

/**
 * The seed behind `npm run seed:platform-admin`. Safe to run any number of times: what exists is
 * left alone, and the password of an existing user is never reset.
 */
export class EnsurePlatformAdminUseCase {
  constructor(private readonly dependencies: EnsurePlatformAdminDependencies) {}

  async execute(input: EnsurePlatformAdminInput): Promise<EnsurePlatformAdminResult> {
    const { users } = this.dependencies;
    const email = normalizeEmail(input.email);
    const existingUser = await users.findByEmail(email);
    if (existingUser !== undefined) {
      const isOperatorCreated = await this.store(existingUser.userId, undefined);
      return { isUserCreated: false, isOperatorCreated };
    }
    const newUser = await this.buildUser(email, input.password);
    const isOperatorCreated = await this.store(newUser.userId, newUser);
    return { isUserCreated: true, isOperatorCreated };
  }

  /** Inserts what is missing in one unit of work; returns whether the operator was created. */
  private async store(userId: UserId, newUser: User | undefined): Promise<boolean> {
    const { users, operators, unitOfWork, clock } = this.dependencies;
    const hasOperator = (await operators.findByUserId(userId)) !== undefined;
    await unitOfWork.run(async () => {
      if (newUser !== undefined) await users.insert(newUser);
      if (!hasOperator) await operators.insert(PlatformOperator.superAdmin(userId, clock.now()));
    });
    return !hasOperator;
  }

  private async buildUser(email: string, rawPassword: string): Promise<User> {
    const password = normalizePassword(rawPassword);
    assertPasswordAcceptable(password, { name: SEEDED_ADMIN_NAME, email });
    return User.create({
      name: SEEDED_ADMIN_NAME,
      email,
      passwordHash: await this.dependencies.hasher.hash(password),
      now: this.dependencies.clock.now(),
    });
  }
}
