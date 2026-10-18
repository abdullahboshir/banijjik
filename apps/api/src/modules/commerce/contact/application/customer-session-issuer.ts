import { CUSTOMER_OTP_RULES } from "@banijjik/contracts/contact";
import { newId, type CustomerAccountId, type OrganizationId } from "@banijjik/ids";
import type { CustomerSession } from "../domain/customer-session.js";
import type { CustomerAuthDependencies } from "./customer-auth-dependencies.js";
import { generateCustomerRefreshToken, hashCustomerRefreshToken } from "./customer-otp-codec.js";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const USER_AGENT_SUMMARY_LENGTH = 120;

/** The two cookie values a sign-in or a refresh hands to the browser. */
export interface IssuedCustomerSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
}

/** Enough of the browser name to recognise a session in a list, never more (09 section 4.1). */
export function summarizeUserAgent(userAgent: string | undefined): string | undefined {
  const trimmed = userAgent?.trim();
  if (trimmed === undefined || trimmed === "") return undefined;
  return trimmed.slice(0, USER_AGENT_SUMMARY_LENGTH);
}

/** Stores a new session and returns its tokens. Call inside the sign-in transaction. */
export async function startCustomerSession(
  dependencies: Pick<CustomerAuthDependencies, "sessions" | "tokens" | "clock">,
  input: {
    readonly customerAccountId: CustomerAccountId;
    readonly organizationId: OrganizationId;
    readonly userAgent: string | undefined;
  },
): Promise<IssuedCustomerSession> {
  const now = dependencies.clock.now();
  const refreshToken = generateCustomerRefreshToken();
  const session: CustomerSession = {
    customerSessionId: newId(),
    customerAccountId: input.customerAccountId,
    refreshTokenHash: hashCustomerRefreshToken(refreshToken),
    previousRefreshTokenHash: undefined,
    expiresAt: new Date(now.getTime() + CUSTOMER_OTP_RULES.sessionDays * MILLISECONDS_PER_DAY),
    lastUsedAt: now,
    userAgentSummary: summarizeUserAgent(input.userAgent),
  };
  await dependencies.sessions.insert(session);
  const accessToken = await dependencies.tokens.issue({
    customerAccountId: input.customerAccountId,
    organizationId: input.organizationId,
  });
  return { accessToken, refreshToken, refreshTokenExpiresAt: session.expiresAt };
}
