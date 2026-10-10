import { TOKEN_AUDIENCE, type TokenAudience } from "@banijjik/contracts";
import { newId, type UserId } from "@banijjik/ids";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MILLISECONDS_PER_SECOND = 1000;
export const USER_AGENT_MAX_LENGTH = 200;

export interface RefreshSessionProps {
  readonly refreshSessionId: string;
  readonly userId: UserId;
  /** The app the session belongs to; a refresh token renews only a session of its own audience (ADR-048). */
  readonly audience: TokenAudience;
  /** All sessions that descend from one login share a family; reuse of an old token revokes the family. */
  readonly familyId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  /** The hard end of the family: sliding renewal never goes past it. */
  readonly familyExpiresAt: Date;
  readonly rotatedAt: Date | undefined;
  readonly revokedAt: Date | undefined;
  readonly replacedByRefreshSessionId: string | undefined;
  readonly userAgent: string | undefined;
  readonly ipHash: string | undefined;
  readonly createdAt: Date;
}

interface ClientTraits {
  readonly userAgent?: string | undefined;
  readonly ipHash?: string | undefined;
}

export interface OpenFamilyInput extends ClientTraits {
  readonly userId: UserId;
  /** Defaults to ADMIN, the audience of every session before the platform panel existed. */
  readonly audience?: TokenAudience;
  readonly tokenHash: string;
  readonly now: Date;
  readonly tokenTtlDays: number;
  readonly familyMaxDays: number;
}

export interface ContinueFamilyInput extends ClientTraits {
  readonly tokenHash: string;
  readonly now: Date;
  readonly tokenTtlDays: number;
}

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * MILLISECONDS_PER_DAY);
}

function limitUserAgent(userAgent: string | undefined): string | undefined {
  return userAgent?.slice(0, USER_AGENT_MAX_LENGTH);
}

/** One refresh token. Only its hash is stored (plan 1.1 decision 11). */
export class RefreshSession implements RefreshSessionProps {
  readonly refreshSessionId: string;
  readonly userId: UserId;
  readonly audience: TokenAudience;
  readonly familyId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly familyExpiresAt: Date;
  readonly rotatedAt: Date | undefined;
  readonly revokedAt: Date | undefined;
  readonly replacedByRefreshSessionId: string | undefined;
  readonly userAgent: string | undefined;
  readonly ipHash: string | undefined;
  readonly createdAt: Date;

  private constructor(props: RefreshSessionProps) {
    this.refreshSessionId = props.refreshSessionId;
    this.userId = props.userId;
    this.audience = props.audience;
    this.familyId = props.familyId;
    this.tokenHash = props.tokenHash;
    this.expiresAt = props.expiresAt;
    this.familyExpiresAt = props.familyExpiresAt;
    this.rotatedAt = props.rotatedAt;
    this.revokedAt = props.revokedAt;
    this.replacedByRefreshSessionId = props.replacedByRefreshSessionId;
    this.userAgent = props.userAgent;
    this.ipHash = props.ipHash;
    this.createdAt = props.createdAt;
  }

  /** The first session of a login or registration: a new family. */
  static openFamily(input: OpenFamilyInput): RefreshSession {
    return new RefreshSession({
      refreshSessionId: newId(),
      userId: input.userId,
      audience: input.audience ?? TOKEN_AUDIENCE.ADMIN,
      familyId: newId(),
      tokenHash: input.tokenHash,
      expiresAt: addDays(input.now, input.tokenTtlDays),
      familyExpiresAt: addDays(input.now, input.familyMaxDays),
      rotatedAt: undefined,
      revokedAt: undefined,
      replacedByRefreshSessionId: undefined,
      userAgent: limitUserAgent(input.userAgent),
      ipHash: input.ipHash,
      createdAt: input.now,
    });
  }

  static restore(props: RefreshSessionProps): RefreshSession {
    return new RefreshSession(props);
  }

  /** The next session after a rotation: sliding expiry, but never past the end of the family. */
  continueFamily(input: ContinueFamilyInput): RefreshSession {
    const slidingExpiry = addDays(input.now, input.tokenTtlDays);
    const expiresAt = slidingExpiry < this.familyExpiresAt ? slidingExpiry : this.familyExpiresAt;
    return new RefreshSession({
      refreshSessionId: newId(),
      userId: this.userId,
      audience: this.audience,
      familyId: this.familyId,
      tokenHash: input.tokenHash,
      expiresAt,
      familyExpiresAt: this.familyExpiresAt,
      rotatedAt: undefined,
      revokedAt: undefined,
      replacedByRefreshSessionId: undefined,
      userAgent: limitUserAgent(input.userAgent),
      ipHash: input.ipHash,
      createdAt: input.now,
    });
  }

  isExpired(now: Date): boolean {
    return now >= this.expiresAt || now >= this.familyExpiresAt;
  }

  isRevoked(): boolean {
    return this.revokedAt !== undefined;
  }

  isRotated(): boolean {
    return this.rotatedAt !== undefined;
  }

  /** True while a rotated token is within the grace window of two tabs racing. */
  wasRotatedWithin(now: Date, graceSeconds: number): boolean {
    if (this.rotatedAt === undefined) return false;
    return now.getTime() - this.rotatedAt.getTime() <= graceSeconds * MILLISECONDS_PER_SECOND;
  }
}
