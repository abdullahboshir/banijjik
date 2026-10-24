import type { CustomerOtpPurpose } from "@banijjik/contracts/contact";
import type { ContactId, CustomerAccountId, CustomerSessionId, UserId } from "@banijjik/ids";
import type { CustomerAccount } from "../../domain/customer-account.entity.js";
import type { CustomerSession } from "../../domain/customer-session.js";
import type { OtpChallenge } from "../../domain/otp-challenge.js";

/** Every read is scoped to the active organization by the tenant plugin. */
export interface CustomerAccountRepository {
  insert(account: CustomerAccount): Promise<void>;
  findById(customerAccountId: CustomerAccountId): Promise<CustomerAccount | undefined>;
  findByPhone(phoneE164: string): Promise<CustomerAccount | undefined>;
  findByContactId(contactId: ContactId): Promise<CustomerAccount | undefined>;
  /** Removes the account of a contact and returns its id, or undefined when there was none. */
  deleteByContactId(contactId: ContactId): Promise<CustomerAccountId | undefined>;
  /** Stamps the sign-in time without a version check: two tabs signing in at once must not conflict. */
  recordLogin(customerAccountId: CustomerAccountId, now: Date): Promise<void>;
  /** Saves a block or an unblock if the stored version is still `expectedVersion`, else a 409. */
  save(
    account: CustomerAccount,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<CustomerAccount>;
}

export interface CustomerSessionRepository {
  insert(session: CustomerSession): Promise<void>;
  findByTokenHash(refreshTokenHash: string): Promise<CustomerSession | undefined>;
  findByPreviousTokenHash(refreshTokenHash: string): Promise<CustomerSession | undefined>;
  /** Swaps the token hash only if it is still `currentHash`; false means another request rotated it first. */
  rotate(input: {
    readonly customerSessionId: CustomerSessionId;
    readonly currentHash: string;
    readonly newHash: string;
    readonly now: Date;
  }): Promise<boolean>;
  deleteById(customerSessionId: CustomerSessionId): Promise<void>;
  deleteAllOfAccount(customerAccountId: CustomerAccountId): Promise<void>;
}

export interface OtpChallengeRepository {
  /** One live challenge per phone: a new one replaces the previous. */
  replaceForPhone(challenge: OtpChallenge): Promise<void>;
  /**
   * Uses one of the guesses of the phone's challenge, atomically: it returns the challenge only if it is
   * unused, unexpired and had attempts left. Parallel guesses therefore cannot exceed the limit.
   */
  reserveGuess(input: {
    readonly phoneE164: string;
    readonly now: Date;
    readonly maxAttempts: number;
  }): Promise<OtpChallenge | undefined>;
  reserveGuessById(input: {
    readonly otpChallengeId: string;
    readonly phoneE164: string;
    readonly purpose: CustomerOtpPurpose;
    readonly now: Date;
    readonly maxAttempts: number;
  }): Promise<OtpChallenge | undefined>;
  /** Marks the challenge used; false when it was already used. */
  consume(otpChallengeId: string, now: Date): Promise<boolean>;
  findById(otpChallengeId: string): Promise<OtpChallenge | undefined>;
  /** Removes the sealed code once the message is sent. */
  clearCode(otpChallengeId: string): Promise<void>;
}

/** The only way a message leaves the system. Drivers: the test inbox now, a real provider later. */
export interface SmsSender {
  send(message: { readonly phoneE164: string; readonly text: string }): Promise<void>;
}

/** Builds the SMS text in the business's language, with the business name and the code. */
export interface OtpMessageComposer {
  compose(code: string, purpose: CustomerOtpPurpose): Promise<string>;
}

/** Signs the short-lived access token of a customer for one business. */
export interface CustomerAccessTokenIssuer {
  issue(input: {
    readonly customerAccountId: string;
    readonly organizationId: string;
  }): Promise<string>;
}
