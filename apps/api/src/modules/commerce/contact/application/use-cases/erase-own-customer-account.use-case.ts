import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import {
  CONTACT_EVENT_TYPE,
  CUSTOMER_OTP_PURPOSE,
  CUSTOMER_OTP_RULES,
  type CustomerEraseResponse,
} from "@banijjik/contracts/contact";
import type { CustomerAccountId, OrganizationId } from "@banijjik/ids";
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

export class EraseOwnCustomerAccountUseCase {
  constructor(private readonly dependencies: CustomerAuthDependencies) {}

  async execute(input: EraseOwnCustomerAccountInput): Promise<CustomerEraseResponse> {
    const { accounts, challenges, contacts, unitOfWork, clock, otpSecret, audit, events } =
      this.dependencies;
    const account = await accounts.findById(input.customerAccountId);
    if (account === undefined) throw otpInvalid();

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

    return unitOfWork.run(async () => {
      const consumed = await challenges.consume(challenge.otpChallengeId, clock.now());
      if (!consumed) throw otpInvalid();

      let forfeitedCredits = 0;
      for (const participant of this.dependencies.erasureParticipants) {
        const result = await participant.eraseForAccount({
          organizationId: input.organizationId,
          customerAccountId: input.customerAccountId,
          now: clock.now(),
        });
        if (result && typeof result.forfeitedCredits === "number") {
          forfeitedCredits += result.forfeitedCredits;
        }
      }

      const contact = await contacts.findById(account.contactId);
      if (contact !== undefined) {
        const anonymized = contact.anonymize(clock.now());
        await contacts.update(anonymized, contact.version, null);
      }
      await endCustomerLogin(
        {
          customerAccounts: accounts,
          customerSessions: this.dependencies.sessions,
          audit,
          events,
        },
        account.contactId,
      );

      await audit.record({
        action: AUDIT_ACTION.CUSTOMER_ACCOUNT_ERASED,
        entityType: AUDIT_ENTITY_TYPE.customerAccount,
        entityId: account.customerAccountId,
      });

      await events.publish(CONTACT_EVENT_TYPE.CUSTOMER_ACCOUNT_ERASED, {
        customerAccountId: account.customerAccountId,
        contactId: account.contactId,
      });

      return {
        erased: true,
        forfeitedCredits,
      };
    });
  }
}
