import type { UserId } from "@banijjik/ids";
import type { PasswordHasher } from "../modules/core/iam/application/ports/password-hasher.js";
import type { PlatformOperatorRepository } from "../modules/core/iam/application/ports/platform-operator-repository.js";
import type { RefreshSessionRepository } from "../modules/core/iam/application/ports/refresh-session-repository.js";
import type { TokenIssuer } from "../modules/core/iam/application/ports/token-issuer.js";
import type { UnitOfWork } from "../modules/core/iam/application/ports/unit-of-work.js";
import type { UserRepository } from "../modules/core/iam/application/ports/user-repository.js";
import { DuplicateIdentifierError } from "../modules/core/iam/domain/errors.js";
import type { PlatformOperator } from "../modules/core/iam/domain/platform-operator.entity.js";
import { RefreshSession } from "../modules/core/iam/domain/refresh-session.entity.js";
import { User } from "../modules/core/iam/domain/user.entity.js";
import type {
  RateLimitDecision,
  RateLimiter,
  RateLimitRequest,
  RateLimitSubject,
} from "../kernel/rate-limit/index.js";

/** Hashes to a readable string and counts calls, so tests can prove that a verify happened. */
export class FakePasswordHasher implements PasswordHasher {
  readonly verifiedHashes: string[] = [];

  async hash(password: string): Promise<string> {
    return `fake-hash:${password}`;
  }

  async verify(hashValue: string, password: string): Promise<boolean> {
    this.verifiedHashes.push(hashValue);
    return hashValue === `fake-hash:${password}`;
  }
}

export class FakeTokenIssuer implements TokenIssuer {
  async issueAccessToken(claims: { userId: UserId; refreshSessionId: string }): Promise<string> {
    return `access-token-for-${claims.refreshSessionId}`;
  }
}

export class PassThroughUnitOfWork implements UnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result> {
    return work();
  }
}

export class InMemoryUserRepository implements UserRepository {
  readonly users = new Map<string, User>();

  async findById(userId: UserId): Promise<User | undefined> {
    return this.users.get(userId);
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return [...this.users.values()].find((user) => user.email === email);
  }

  async findByPhone(phoneE164: string): Promise<User | undefined> {
    return [...this.users.values()].find((user) => user.phoneE164 === phoneE164);
  }

  async insert(user: User): Promise<void> {
    if (user.email !== undefined && (await this.findByEmail(user.email)) !== undefined) {
      throw new DuplicateIdentifierError("email");
    }
    if (user.phoneE164 !== undefined && (await this.findByPhone(user.phoneE164)) !== undefined) {
      throw new DuplicateIdentifierError("phone");
    }
    this.users.set(user.userId, user);
  }

  async saveProfile(user: User, expectedVersion: number): Promise<User> {
    const stored = this.users.get(user.userId);
    if (stored?.version !== expectedVersion) throw new Error("version conflict");
    const saved = User.restore({ ...user, version: expectedVersion + 1 });
    this.users.set(user.userId, saved);
    return saved;
  }

  async recordLogin(userId: UserId, at: Date): Promise<void> {
    const stored = this.users.get(userId);
    if (stored !== undefined) this.users.set(userId, User.restore({ ...stored, lastLoginAt: at }));
  }

  replace(user: User): void {
    this.users.set(user.userId, user);
  }
}

export class InMemoryRefreshSessionRepository implements RefreshSessionRepository {
  readonly sessions = new Map<string, RefreshSession>();

  async insert(session: RefreshSession): Promise<void> {
    this.sessions.set(session.refreshSessionId, session);
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshSession | undefined> {
    return [...this.sessions.values()].find((session) => session.tokenHash === tokenHash);
  }

  async markRotated(id: string, replacedById: string, at: Date): Promise<boolean> {
    const stored = this.sessions.get(id);
    if (stored === undefined || stored.isRotated() || stored.isRevoked()) return false;
    this.update(stored, { rotatedAt: at, replacedByRefreshSessionId: replacedById });
    return true;
  }

  async revokeFamily(familyId: string, at: Date): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.familyId === familyId && !session.isRevoked())
        this.update(session, { revokedAt: at });
    }
  }

  async revokeAllForUser(userId: UserId, at: Date): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.userId === userId && !session.isRevoked())
        this.update(session, { revokedAt: at });
    }
  }

  async revoke(refreshSessionId: string, at: Date): Promise<void> {
    const stored = this.sessions.get(refreshSessionId);
    if (stored !== undefined) this.update(stored, { revokedAt: at });
  }

  private update(session: RefreshSession, changes: Partial<RefreshSession>): void {
    this.sessions.set(session.refreshSessionId, RefreshSession.restore({ ...session, ...changes }));
  }
}

export class InMemoryPlatformOperatorRepository implements PlatformOperatorRepository {
  readonly operators = new Map<string, PlatformOperator>();

  async findByUserId(userId: UserId): Promise<PlatformOperator | undefined> {
    return [...this.operators.values()].find((operator) => operator.userId === userId);
  }

  async insert(operator: PlatformOperator): Promise<void> {
    this.operators.set(operator.platformOperatorId, operator);
  }
}

/** Counts attempts per subject without windows: enough to test the use case rules. */
export class InMemoryRateLimiter implements RateLimiter {
  readonly counts = new Map<string, number>();

  async consume(request: RateLimitRequest): Promise<RateLimitDecision> {
    const key = `${request.bucket}:${request.key}`;
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    return { allowed: count <= request.limit, retryAfterSeconds: 60 };
  }

  async reset(subject: RateLimitSubject): Promise<void> {
    this.counts.delete(`${subject.bucket}:${subject.key}`);
  }
}
