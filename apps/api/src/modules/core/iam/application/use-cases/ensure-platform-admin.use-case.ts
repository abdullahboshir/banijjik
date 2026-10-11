import type { UserId } from "@banijjik/ids";
import type { Clock } from "../../../../../kernel/time/index.js";
import { assertPasswordAcceptable, normalizePassword } from "../../domain/password-policy.js";
import { PlatformOperator } from "../../domain/platform-operator.entity.js";
import { normalizeEmail, User } from "../../domain/user.entity.js";
import type { PasswordHasher } from "../ports/password-hasher.js";
import type { SeededOperatorAudit } from "../ports/seeded-operator-audit.js";
import type { PlatformOperatorRepository } from "../ports/platform-operator-repository.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";
import type { UserRepository } from "../ports/user-repository.js";

export interface EnsurePlatformAdminInput {
  readonly email: string;
  readonly password: string;
}

export type EnsurePlatformAdminResult =
  | {
      readonly isUserCreated: boolean;
      readonly isOperatorCreated: boolean;
    }
  | {
      /** The email belongs to an account the seed password does not open: nothing was created. */
      readonly refusal: "PASSWORD_MISMATCH";
    };

export interface EnsurePlatformAdminDependencies {
  readonly users: UserRepository;
  readonly operators: PlatformOperatorRepository;
  readonly hasher: PasswordHasher;
  readonly unitOfWork: UnitOfWork;
  readonly seededOperatorAudit: SeededOperatorAudit;
  readonly clock: Clock;
}

const SEEDED_ADMIN_NAME = "Platform Admin";

/**
 * The seed behind `npm run seed:platform-admin`. Safe to run any number of times: what exists is
 * left alone, and the password of an existing user is never reset.
 *
 * An account that exists without an operator record is promoted only when the configured password
 * opens it. Registration is public and the email is not verified, so anyone could have registered
 * the admin address first; matching the password proves the person who set the environment owns it.
 */
export class EnsurePlatformAdminUseCase {
  constructor(private readonly dependencies: EnsurePlatformAdminDependencies) {}

  async execute(input: EnsurePlatformAdminInput): Promise<EnsurePlatformAdminResult> {
    const { users, operators } = this.dependencies;
    const email = normalizeEmail(input.email);
    const existingUser = await users.findByEmail(email);
    if (existingUser === undefined) {
      const newUser = await this.buildUser(email, input.password);
      const isOperatorCreated = await this.store(newUser.userId, newUser);
      return { isUserCreated: true, isOperatorCreated };
    }
    const hasOperator = (await operators.findByUserId(existingUser.userId)) !== undefined;
    if (hasOperator) return { isUserCreated: false, isOperatorCreated: false };
    const password = normalizePassword(input.password);
    if (!(await this.dependencies.hasher.verify(existingUser.passwordHash, password))) {
      return { refusal: "PASSWORD_MISMATCH" };
    }
    const isOperatorCreated = await this.store(existingUser.userId, undefined);
    return { isUserCreated: false, isOperatorCreated };
  }

  /** Inserts what is missing, and the audit entry of the new operator, in one unit of work. */
  private async store(userId: UserId, newUser: User | undefined): Promise<boolean> {
    const { users, operators, unitOfWork, clock } = this.dependencies;
    const hasOperator = (await operators.findByUserId(userId)) !== undefined;
    await unitOfWork.run(async () => {
      if (newUser !== undefined) await users.insert(newUser);
      if (hasOperator) return;
      const operator = PlatformOperator.superAdmin(userId, clock.now());
      await operators.insert(operator);
      await this.dependencies.seededOperatorAudit.recordSeeded(operator);
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
