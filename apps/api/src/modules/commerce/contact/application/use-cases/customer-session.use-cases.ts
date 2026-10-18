import { CUSTOMER_OTP_RULES, type StorefrontMeResponse } from "@banijjik/contracts/contact";
import type { CustomerAccountId, OrganizationId } from "@banijjik/ids";
import type { CustomerSession } from "../../domain/customer-session.js";
import { customerAccountNotFound, customerSessionNotValid } from "../../domain/errors.js";
import type { CustomerAuthDependencies } from "../customer-auth-dependencies.js";
import { generateCustomerRefreshToken, hashCustomerRefreshToken } from "../customer-otp-codec.js";
import type { IssuedCustomerSession } from "../customer-session-issuer.js";

export interface RefreshCustomerSessionInput {
  readonly organizationId: OrganizationId;
  readonly refreshToken: string | undefined;
}

/**
 * Rotating refresh tokens (as the admin sessions do, ADR-048): a token works once and its successor
 * takes over. Showing an old token again means it was copied, so the session is deleted.
 */
export class RefreshCustomerSessionUseCase {
  constructor(private readonly dependencies: CustomerAuthDependencies) {}

  async execute(input: RefreshCustomerSessionInput): Promise<IssuedCustomerSession> {
    const session = await this.findUsableSession(input.refreshToken);
    const account = await this.dependencies.accounts.findById(session.customerAccountId);
    if (account === undefined || !account.isActive()) {
      await this.dependencies.sessions.deleteById(session.customerSessionId);
      throw customerSessionNotValid();
    }
    return this.rotate(session, input.organizationId);
  }

  private async findUsableSession(refreshToken: string | undefined): Promise<CustomerSession> {
    const { sessions, clock } = this.dependencies;
    if (refreshToken === undefined || refreshToken === "") throw customerSessionNotValid();
    const tokenHash = hashCustomerRefreshToken(refreshToken);
    const session = await sessions.findByTokenHash(tokenHash);
    if (session === undefined) return this.rejectUnknown(tokenHash);
    if (session.expiresAt.getTime() <= clock.now().getTime()) throw customerSessionNotValid();
    return session;
  }

  /**
   * A token that was replaced a moment ago is two requests racing: refuse, keep the session. A token
   * replaced longer ago is a copy in use: end the whole session.
   */
  private async rejectUnknown(tokenHash: string): Promise<never> {
    const { sessions } = this.dependencies;
    const replaced = await sessions.findByPreviousTokenHash(tokenHash);
    if (replaced !== undefined && !this.isWithinGrace(replaced)) {
      await sessions.deleteById(replaced.customerSessionId);
    }
    throw customerSessionNotValid();
  }

  private isWithinGrace(replaced: CustomerSession): boolean {
    const ageMs = this.dependencies.clock.now().getTime() - replaced.lastUsedAt.getTime();
    return ageMs <= CUSTOMER_OTP_RULES.refreshReuseGraceSeconds * 1000;
  }

  private async rotate(
    session: CustomerSession,
    organizationId: OrganizationId,
  ): Promise<IssuedCustomerSession> {
    const { sessions, tokens, clock } = this.dependencies;
    const refreshToken = generateCustomerRefreshToken();
    const wasRotated = await sessions.rotate({
      customerSessionId: session.customerSessionId,
      currentHash: session.refreshTokenHash,
      newHash: hashCustomerRefreshToken(refreshToken),
      now: clock.now(),
    });
    // Another request used the same token between our read and our write: exactly one wins.
    if (!wasRotated) throw customerSessionNotValid();
    const accessToken = await tokens.issue({
      customerAccountId: session.customerAccountId,
      organizationId,
    });
    return { accessToken, refreshToken, refreshTokenExpiresAt: session.expiresAt };
  }
}

/** Signing out deletes the session of this browser; an unknown token is simply already signed out. */
export class LogoutCustomerUseCase {
  constructor(private readonly dependencies: Pick<CustomerAuthDependencies, "sessions">) {}

  async execute(refreshToken: string | undefined): Promise<void> {
    if (refreshToken === undefined || refreshToken === "") return;
    const { sessions } = this.dependencies;
    const session = await sessions.findByTokenHash(hashCustomerRefreshToken(refreshToken));
    if (session !== undefined) await sessions.deleteById(session.customerSessionId);
  }
}

/** The signed-in customer: the account, with the name from the contact. */
export class GetStorefrontMeUseCase {
  constructor(
    private readonly dependencies: Pick<CustomerAuthDependencies, "accounts" | "contacts">,
  ) {}

  async execute(customerAccountId: CustomerAccountId): Promise<StorefrontMeResponse> {
    const { accounts, contacts } = this.dependencies;
    const account = await accounts.findById(customerAccountId);
    if (account === undefined) throw customerAccountNotFound();
    const names = await contacts.findNames([account.contactId]);
    return {
      customerAccountId: account.customerAccountId,
      contactId: account.contactId,
      phoneE164: account.phoneE164,
      name: names.get(account.contactId) ?? null,
    };
  }
}
