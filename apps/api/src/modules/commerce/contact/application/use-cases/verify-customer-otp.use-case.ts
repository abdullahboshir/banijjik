import { CUSTOMER_OTP_RULES } from "@banijjik/contracts/contact";
import type { CustomerAccountId, OrganizationId } from "@banijjik/ids";
import { ContactPhoneTakenError, customerAccountBlocked, otpInvalid } from "../../domain/errors.js";
import type { CustomerAuthDependencies } from "../customer-auth-dependencies.js";
import { hashOtpCode, sameHash } from "../customer-otp-codec.js";
import { startCustomerSession, type IssuedCustomerSession } from "../customer-session-issuer.js";
import { findOrCreateCustomerAccount, findOrCreateCustomerContact } from "../customer-sign-in.js";

/** The tokens for the cookies, and whose they are. */
export interface CustomerSignInResult {
  readonly session: IssuedCustomerSession;
  readonly customerAccountId: CustomerAccountId;
}

export interface VerifyCustomerOtpInput {
  readonly organizationId: OrganizationId;
  readonly phoneE164: string;
  readonly code: string;
  readonly userAgent: string | undefined;
}

/**
 * Signs a customer in with the code. A wrong, expired, used or replaced code is one answer
 * (`otp_invalid`). Every guess uses one of five attempts before the code is compared, so parallel
 * guesses cannot exceed the limit. A blocked account is told only after the code was right.
 */
export class VerifyCustomerOtpUseCase {
  constructor(private readonly dependencies: CustomerAuthDependencies) {}

  async execute(input: VerifyCustomerOtpInput): Promise<CustomerSignInResult> {
    const { challenges, clock, otpSecret } = this.dependencies;
    const challenge = await challenges.reserveGuess({
      phoneE164: input.phoneE164,
      now: clock.now(),
      maxAttempts: CUSTOMER_OTP_RULES.maxWrongAttempts,
    });
    if (challenge === undefined) throw otpInvalid();
    const expectedHash = hashOtpCode(otpSecret, input.phoneE164, input.code);
    if (!sameHash(challenge.codeHash, expectedHash)) throw otpInvalid();
    return this.signIn(input, challenge.otpChallengeId);
  }

  /** Two first sign-ins of one new phone can race on the contact; the loser retries and finds the winner's contact. */
  private async signIn(
    input: VerifyCustomerOtpInput,
    otpChallengeId: string,
  ): Promise<CustomerSignInResult> {
    try {
      return await this.signInOnce(input, otpChallengeId);
    } catch (error) {
      if (!(error instanceof ContactPhoneTakenError)) throw error;
      return this.signInOnce(input, otpChallengeId);
    }
  }

  private signInOnce(
    input: VerifyCustomerOtpInput,
    otpChallengeId: string,
  ): Promise<CustomerSignInResult> {
    const { unitOfWork, challenges, accounts, clock } = this.dependencies;
    return unitOfWork.run(async () => {
      if (!(await challenges.consume(otpChallengeId, clock.now()))) throw otpInvalid();
      const contact = await findOrCreateCustomerContact(this.dependencies, input);
      const account = await findOrCreateCustomerAccount(
        this.dependencies,
        contact,
        input.phoneE164,
      );
      if (!account.isActive()) throw customerAccountBlocked();
      await accounts.recordLogin(account.customerAccountId, clock.now());
      const session = await startCustomerSession(this.dependencies, {
        customerAccountId: account.customerAccountId,
        organizationId: input.organizationId,
        userAgent: input.userAgent,
      });
      return { session, customerAccountId: account.customerAccountId };
    });
  }
}
