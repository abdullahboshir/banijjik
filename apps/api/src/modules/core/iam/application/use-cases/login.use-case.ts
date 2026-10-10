import { TOKEN_AUDIENCE, USER_STATUS, type TokenAudience } from "@banijjik/contracts";
import type { LoginIdentifier } from "@banijjik/validation";
import type { RateLimiter, RateLimitSubject } from "../../../../../kernel/rate-limit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { AUTH_RATE_LIMIT, type AuthRateLimit } from "../../domain/auth-limits.js";
import { invalidCredentials, tooManyAttempts } from "../../domain/errors.js";
import { normalizePassword } from "../../domain/password-policy.js";
import type { PlatformOperator } from "../../domain/platform-operator.entity.js";
import type { User } from "../../domain/user.entity.js";
import type { AuthenticationResult } from "../authentication-result.js";
import type { PasswordHasher } from "../ports/password-hasher.js";
import type { PlatformOperatorRepository } from "../ports/platform-operator-repository.js";
import type { RefreshSessionRepository } from "../ports/refresh-session-repository.js";
import type { UserRepository } from "../ports/user-repository.js";
import type { ClientInfo, SessionIssuer } from "../session-issuer.js";

export interface LoginInput {
  readonly identifier: LoginIdentifier;
  readonly password: string;
  readonly client: ClientInfo;
}

export interface LoginDependencies {
  readonly users: UserRepository;
  readonly sessions: RefreshSessionRepository;
  readonly hasher: PasswordHasher;
  readonly sessionIssuer: SessionIssuer;
  readonly rateLimiter: RateLimiter;
  readonly clock: Clock;
  /** Defaults to ADMIN. A PLATFORM login also needs `operators`. */
  readonly audience?: TokenAudience;
  readonly operators?: PlatformOperatorRepository;
  /** The per-identifier attempt limit; the platform login counts in its own bucket. */
  readonly identifierLimit?: AuthRateLimit;
}

// Hashed once and verified when the user does not exist, so both failures cost the same time.
const DUMMY_PASSWORD = "dummy-password-for-constant-time-login";

/**
 * Email or phone plus password. Unknown identifier and wrong password are one and the same answer.
 * The platform login (audience PLATFORM) also needs an ACTIVE PlatformOperator for the user, and a
 * user who is no operator gets that same answer, so the endpoint never says who is an operator.
 */
export class LoginUseCase {
  private readonly dummyHash: Promise<string>;

  constructor(private readonly dependencies: LoginDependencies) {
    this.dummyHash = dependencies.hasher.hash(DUMMY_PASSWORD);
  }

  async execute(input: LoginInput): Promise<AuthenticationResult> {
    const { users, sessions, sessionIssuer, rateLimiter, clock } = this.dependencies;
    const audience = this.dependencies.audience ?? TOKEN_AUDIENCE.ADMIN;
    const subject: RateLimitSubject = {
      bucket: this.identifierLimit().bucket,
      key: `${input.identifier.kind}:${input.identifier.value}`,
    };
    await this.consumeAttempt(subject);
    const user = await this.verifyCredentials(input);
    const operator = await this.requireOperatorIfPlatform(user);
    // The status is checked only after the password was right, so a guesser cannot find locked accounts.
    user.assertCanAuthenticate();
    await rateLimiter.reset(subject);
    await users.recordLogin(user.userId, clock.now());
    const prepared = await sessionIssuer.openFamily(user.userId, input.client, audience);
    await sessions.insert(prepared.session);
    return { user, issued: prepared.issued, ...(operator === undefined ? {} : { operator }) };
  }

  private identifierLimit(): AuthRateLimit {
    return this.dependencies.identifierLimit ?? AUTH_RATE_LIMIT.LOGIN_PER_IDENTIFIER;
  }

  /** Checked before the account status, so a locked non-operator is not told apart either. */
  private async requireOperatorIfPlatform(user: User): Promise<PlatformOperator | undefined> {
    const { audience, operators } = this.dependencies;
    if (audience !== TOKEN_AUDIENCE.PLATFORM) return undefined;
    const operator = await operators?.findByUserId(user.userId);
    if (operator === undefined || operator.status !== USER_STATUS.ACTIVE)
      throw invalidCredentials();
    return operator;
  }

  /** Every attempt counts; a successful login clears the count again. */
  private async consumeAttempt(subject: RateLimitSubject): Promise<void> {
    const limit = this.identifierLimit();
    const decision = await this.dependencies.rateLimiter.consume({ ...subject, ...limit });
    if (!decision.allowed) throw tooManyAttempts(decision.retryAfterSeconds);
  }

  private async verifyCredentials(input: LoginInput): Promise<User> {
    const { users, hasher } = this.dependencies;
    const { kind, value } = input.identifier;
    const user = await (kind === "EMAIL" ? users.findByEmail(value) : users.findByPhone(value));
    const hash = user?.passwordHash ?? (await this.dummyHash);
    const isMatch = await hasher.verify(hash, normalizePassword(input.password));
    if (user === undefined || !isMatch) throw invalidCredentials();
    return user;
  }
}
