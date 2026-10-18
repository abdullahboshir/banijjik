import { CUSTOMER_OTP_RULES, CONTACT_EVENT_TYPE } from "@banijjik/contracts/contact";
import type { CustomerOtpSendResponse } from "@banijjik/contracts/contact";
import { newId, type OrganizationId } from "@banijjik/ids";
import { tooManyCodes } from "../../domain/errors.js";
import type { OtpChallenge } from "../../domain/otp-challenge.js";
import type { CustomerAuthDependencies } from "../customer-auth-dependencies.js";
import { generateOtpCode, hashOtpCode, sealOtpCode } from "../customer-otp-codec.js";

export const OTP_SEND_PHONE_BUCKET = "customer.otp.send.phone";
const MILLISECONDS_PER_SECOND = 1000;

export interface SendCustomerOtpInput {
  readonly organizationId: OrganizationId;
  readonly phoneE164: string;
}

/**
 * Asks for a sign-in code. The answer is the same for an unknown, a known and a blocked phone, so
 * nobody can learn which numbers have accounts; a blocked account simply gets no SMS (no cost).
 * The message itself goes out through the outbox, never inline (ADR-090).
 */
export class SendCustomerOtpUseCase {
  constructor(private readonly dependencies: CustomerAuthDependencies) {}

  async execute(input: SendCustomerOtpInput): Promise<CustomerOtpSendResponse> {
    const { limiter, accounts, challenges, unitOfWork, events, clock, otpSecret } =
      this.dependencies;
    const rule = CUSTOMER_OTP_RULES.sendsPerPhone;
    const decision = await limiter.consume({
      bucket: OTP_SEND_PHONE_BUCKET,
      key: `${input.organizationId}:${input.phoneE164}`,
      limit: rule.limit,
      windowSeconds: rule.windowSeconds,
    });
    if (!decision.allowed) throw tooManyCodes(decision.retryAfterSeconds);
    const answer = { expiresInSeconds: CUSTOMER_OTP_RULES.expiresInSeconds };
    const account = await accounts.findByPhone(input.phoneE164);
    if (account !== undefined && !account.isActive()) return answer;
    const code = generateOtpCode();
    const challenge: OtpChallenge = {
      otpChallengeId: newId(),
      phoneE164: input.phoneE164,
      codeHash: hashOtpCode(otpSecret, input.phoneE164, code),
      codeCiphertext: sealOtpCode(otpSecret, code),
      attempts: 0,
      expiresAt: new Date(
        clock.now().getTime() + answer.expiresInSeconds * MILLISECONDS_PER_SECOND,
      ),
      consumedAt: undefined,
    };
    await unitOfWork.run(async () => {
      await challenges.replaceForPhone(challenge);
      // Ids only: the code and the phone never enter the outbox (ADR-119).
      await events.publish(CONTACT_EVENT_TYPE.CUSTOMER_OTP_REQUESTED, {
        otpChallengeId: challenge.otpChallengeId,
      });
    });
    return answer;
  }
}
