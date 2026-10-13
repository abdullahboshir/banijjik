import { TOKEN_AUDIENCE, USER_STATUS, type TokenAudience } from "@banijjik/contracts";
import type { LoginIdentifier } from "@banijjik/validation";
import type { RateLimiter, RateLimitRequest } from "../../../../../kernel/rate-limit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { ADMIN_LOGIN_LIMITS, type LoginLimits } from "../../domain/auth-limits.js";
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
  /** The failed-login buckets; the platform login counts in its own. */
  readonly limits?: LoginLimits;
}

const UNKNOWN_ADDRESS = "unknown";

interface LoginAttemptRequests {
  readonly perIdentifierAndIp: RateLimitRequest;
  readonly perIdentifier: RateLimitRequest;
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
    const { users, sessions, sessionIssuer, clock } = this.dependencies;
    const audience = this.dependencies.audience ?? TOKEN_AUDIENCE.ADMIN;
    const attempts = this.attemptRequests(input);
    await this.reserveAttempts(attempts);
    const user = await this.verifyCredentials(input);
    const operator = await this.requireOperatorIfPlatform(user);
    // The status is checked only after the password was right, so a guesser cannot find locked accounts.
    user.assertCanAuthenticate();
    await this.clearAttempts(attempts);
    await users.recordLogin(user.userId, clock.now());
    const prepared = await sessionIssuer.openFamily(user.userId, input.client, audience);
    await sessions.insert(prepared.session);
    return { user, issued: prepared.issued, ...(operator === undefined ? {} : { operator }) };
  }

  private attemptRequests(input: LoginInput): LoginAttemptRequests {
    const { perIdentifierAndIp, perIdentifier } = this.dependencies.limits ?? ADMIN_LOGIN_LIMITS;
    const identifierKey = `${input.identifier.kind}:${input.identifier.value}`;
    const address = input.client.ipAddress ?? UNKNOWN_ADDRESS;
    return {
      perIdentifierAndIp: { ...perIdentifierAndIp, key: `${identifierKey}|${address}` },
      perIdentifier: { ...perIdentifier, key: identifierKey },
    };
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

  /**
   * The attempt is counted before the password is checked, so parallel guesses cannot all pass a
   * read-then-count gap. A success gives it back (`clearAttempts`), so in the end only failures count.
   * Only an attempt that gets as far as a password check may count against the identifier-wide bucket,
   * otherwise a few addresses could lock a person out with requests that were never evaluated (review 1, R1-1).
   */
  private async reserveAttempts(attempts: LoginAttemptRequests): Promise<void> {
    const { rateLimiter } = this.dependencies;
    const byAddress = await rateLimiter.consume(attempts.perIdentifierAndIp);
    if (!byAddress.allowed) throw tooManyAttempts(byAddress.retryAfterSeconds);
    const byIdentifier = await rateLimiter.consume(attempts.perIdentifier);
    if (byIdentifier.allowed) return;
    await rateLimiter.refund(attempts.perIdentifierAndIp);
    throw tooManyAttempts(byIdentifier.retryAfterSeconds);
  }

  /** A success forgets the failures of this address and does not use up the identifier-wide allowance. */
  private async clearAttempts(attempts: LoginAttemptRequests): Promise<void> {
    const { rateLimiter } = this.dependencies;
    await rateLimiter.reset(attempts.perIdentifierAndIp);
    await rateLimiter.refund(attempts.perIdentifier);
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
