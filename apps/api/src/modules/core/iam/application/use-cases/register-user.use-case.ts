import type { PreferredLocale } from "@banijjik/contracts";
import type { Clock } from "../../../../../kernel/time/index.js";
import { assertPasswordAcceptable, normalizePassword } from "../../domain/password-policy.js";
import { assertHasIdentifier, User } from "../../domain/user.entity.js";
import type { AuthenticationResult } from "../authentication-result.js";
import type { PasswordHasher } from "../ports/password-hasher.js";
import type { RefreshSessionRepository } from "../ports/refresh-session-repository.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";
import type { UserRepository } from "../ports/user-repository.js";
import type { ClientInfo, SessionIssuer } from "../session-issuer.js";

export interface RegisterUserInput {
  readonly name: string;
  readonly email?: string | undefined;
  readonly phoneE164?: string | undefined;
  readonly password: string;
  readonly preferredLocale?: PreferredLocale | undefined;
  readonly client: ClientInfo;
}

export interface RegisterUserDependencies {
  readonly users: UserRepository;
  readonly sessions: RefreshSessionRepository;
  readonly hasher: PasswordHasher;
  readonly sessionIssuer: SessionIssuer;
  readonly unitOfWork: UnitOfWork;
  readonly clock: Clock;
}

/** Self-registration with a password (owner decision 2026-10-11). The new user is signed in at once. */
export class RegisterUserUseCase {
  constructor(private readonly dependencies: RegisterUserDependencies) {}

  async execute(input: RegisterUserInput): Promise<AuthenticationResult> {
    const { hasher, clock, sessionIssuer, unitOfWork, users, sessions } = this.dependencies;
    // Cheap checks first: a bad request must not cost a password hash.
    assertHasIdentifier(input.email, input.phoneE164);
    const password = normalizePassword(input.password);
    assertPasswordAcceptable(password, {
      name: input.name,
      email: input.email,
      phoneE164: input.phoneE164,
    });
    const user = User.create({
      name: input.name,
      email: input.email,
      phoneE164: input.phoneE164,
      passwordHash: await hasher.hash(password),
      preferredLocale: input.preferredLocale,
      now: clock.now(),
    });
    const prepared = await sessionIssuer.openFamily(user.userId, input.client);
    // User and first session are stored together or not at all.
    await unitOfWork.run(async () => {
      await users.insert(user);
      await sessions.insert(prepared.session);
    });
    return { user, issued: prepared.issued };
  }
}
