import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import {
  CONTACT_EVENT_TYPE,
  CUSTOMER_OTP_PURPOSE,
  CUSTOMER_OTP_RULES,
  type CustomerEraseResponse,
} from "@banijjik/contracts/contact";
import type { CustomerAccountId, OrganizationId } from "@banijjik/ids";
import type { CustomerAccount } from "../../domain/customer-account.entity.js";
import { otpInvalid } from "../../domain/errors.js";
import type { CustomerAuthDependencies } from "../customer-auth-dependencies.js";
import { hashOtpCode, sameHash } from "../customer-otp-codec.js";
import { endCustomerLogin } from "../end-customer-login.js";

export interface EraseOwnCustomerAccountInput {
  readonly organizationId: OrganizationId;
  readonly customerAccountId: CustomerAccountId;
  readonly challengeId: string;
  readonly code: string;
}

export type EraseOwnCustomerAccountDependencies = Pick<
  CustomerAuthDependencies,
  | "accounts"
  | "challenges"
  | "contacts"
  | "sessions"
  | "unitOfWork"
  | "clock"
  | "otpSecret"
  | "audit"
  | "events"
  | "erasureParticipants"
>;

export class EraseOwnCustomerAccountUseCase {
  constructor(private readonly dependencies: EraseOwnCustomerAccountDependencies) {}

  async execute(input: EraseOwnCustomerAccountInput): Promise<CustomerEraseResponse> {
    const { accounts, unitOfWork, clock, erasureParticipants } = this.dependencies;
    const account = await accounts.findById(input.customerAccountId);
    if (account === undefined) throw otpInvalid();
    const challengeId = await this.checkCode(input, account);

    return unitOfWork.run(async () => {
      const consumed = await this.dependencies.challenges.consume(challengeId, clock.now());
      if (!consumed) throw otpInvalid();

      let forfeitedCredits = 0;
      for (const participant of erasureParticipants) {
        const result = await participant.eraseForAccount({
          organizationId: input.organizationId,
          customerAccountId: input.customerAccountId,
          now: clock.now(),
        });
        forfeitedCredits += result.forfeitedCredits;
      }
      await this.anonymizeContactAndEndLogin(account);
      await this.recordErasure(account);
      return { erased: true, forfeitedCredits };
    });
  }

  /** Counts the guess before comparing, so a wrong code costs an attempt even if the erase fails. */
  private async checkCode(
    input: EraseOwnCustomerAccountInput,
    account: CustomerAccount,
  ): Promise<string> {
    const { challenges, clock, otpSecret } = this.dependencies;
    const challenge = await challenges.reserveGuessById({
      otpChallengeId: input.challengeId,
      phoneE164: account.phoneE164,
      purpose: CUSTOMER_OTP_PURPOSE.ERASE_ACCOUNT,
      now: clock.now(),
      maxAttempts: CUSTOMER_OTP_RULES.maxWrongAttempts,
    });
    if (challenge === undefined) throw otpInvalid();
    const expectedHash = hashOtpCode(otpSecret, account.phoneE164, input.code);
    if (!sameHash(challenge.codeHash, expectedHash)) throw otpInvalid();
    return challenge.otpChallengeId;
  }

  private async anonymizeContactAndEndLogin(account: CustomerAccount): Promise<void> {
    const { contacts, accounts, sessions, audit, events, clock } = this.dependencies;
    const contact = await contacts.findById(account.contactId);
    if (contact !== undefined && contact.anonymizedAt === undefined) {
      await contacts.update(contact.anonymize(clock.now()), contact.version, null);
    }
    await endCustomerLogin(
      { customerAccounts: accounts, customerSessions: sessions, audit, events },
      account.contactId,
    );
  }

  /** Ids only: the account is gone, and neither the audit row nor the event may carry personal data. */
  private async recordErasure(account: CustomerAccount): Promise<void> {
    const { audit, events } = this.dependencies;
    await audit.record({
      action: AUDIT_ACTION.CUSTOMER_ACCOUNT_ERASED,
      entityType: AUDIT_ENTITY_TYPE.customerAccount,
      entityId: account.customerAccountId,
    });
    await events.publish(CONTACT_EVENT_TYPE.CUSTOMER_ACCOUNT_ERASED, {
      customerAccountId: account.customerAccountId,
      contactId: account.contactId,
    });
  }
}
