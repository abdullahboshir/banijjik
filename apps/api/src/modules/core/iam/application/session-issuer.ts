import type { UserId } from "@banijjik/ids";
import { RefreshSession } from "../domain/refresh-session.entity.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { TokenIssuer } from "./ports/token-issuer.js";
import {
  generateRefreshToken,
  hashClientAddress,
  hashRefreshToken,
} from "./refresh-token-secret.js";

export interface ClientInfo {
  readonly userAgent?: string | undefined;
  readonly ipAddress?: string | undefined;
}

export interface SessionPolicy {
  readonly refreshTokenTtlDays: number;
  readonly familyMaxDays: number;
  /** Salt for the stored address hash. */
  readonly ipHashSecret: string;
}

/** What the controller turns into cookies. */
export interface IssuedSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
}

/** A session that is built and signed but not stored yet; the use case stores it in its own unit of work. */
export interface PreparedSession {
  readonly session: RefreshSession;
  readonly issued: IssuedSession;
}

export interface SessionIssuerDependencies {
  readonly tokenIssuer: TokenIssuer;
  readonly clock: Clock;
  readonly policy: SessionPolicy;
}

/** Builds refresh sessions and their tokens for login, registration and rotation. */
export class SessionIssuer {
  constructor(private readonly dependencies: SessionIssuerDependencies) {}

  /** The first session of a login: starts a new family. */
  async openFamily(userId: UserId, client: ClientInfo): Promise<PreparedSession> {
    const { clock, policy } = this.dependencies;
    const refreshToken = generateRefreshToken();
    const session = RefreshSession.openFamily({
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      now: clock.now(),
      tokenTtlDays: policy.refreshTokenTtlDays,
      familyMaxDays: policy.familyMaxDays,
      ...this.clientTraits(client),
    });
    return this.sign(session, refreshToken);
  }

  /** The session that replaces `previous` on rotation: same family, new token. */
  async continueFamily(previous: RefreshSession, client: ClientInfo): Promise<PreparedSession> {
    const { clock, policy } = this.dependencies;
    const refreshToken = generateRefreshToken();
    const session = previous.continueFamily({
      tokenHash: hashRefreshToken(refreshToken),
      now: clock.now(),
      tokenTtlDays: policy.refreshTokenTtlDays,
      ...this.clientTraits(client),
    });
    return this.sign(session, refreshToken);
  }

  private clientTraits(client: ClientInfo): { userAgent?: string; ipHash?: string } {
    const { ipHashSecret } = this.dependencies.policy;
    return {
      ...(client.userAgent === undefined ? {} : { userAgent: client.userAgent }),
      ...(client.ipAddress === undefined
        ? {}
        : { ipHash: hashClientAddress(client.ipAddress, ipHashSecret) }),
    };
  }

  private async sign(session: RefreshSession, refreshToken: string): Promise<PreparedSession> {
    const accessToken = await this.dependencies.tokenIssuer.issueAccessToken({
      userId: session.userId,
      refreshSessionId: session.refreshSessionId,
    });
    return {
      session,
      issued: { accessToken, refreshToken, refreshTokenExpiresAt: session.expiresAt },
    };
  }
}
