import {
  CONTACT_EVENT_TYPE,
  CUSTOMER_OTP_PURPOSE,
  CUSTOMER_OTP_RULES,
  type CustomerEraseOtpSendResponse,
} from "@banijjik/contracts/contact";
import { newId, type CustomerAccountId, type OrganizationId } from "@banijjik/ids";
import { customerAccountBlocked, otpInvalid, tooManyCodes } from "../../domain/errors.js";
import type { OtpChallenge } from "../../domain/otp-challenge.js";
import type { CustomerAuthDependencies } from "../customer-auth-dependencies.js";
import { generateOtpCode, hashOtpCode, sealOtpCode } from "../customer-otp-codec.js";
import { OTP_SEND_PHONE_BUCKET } from "./send-customer-otp.use-case.js";

const MILLISECONDS_PER_SECOND = 1000;

export interface SendCustomerEraseOtpInput {
  readonly organizationId: OrganizationId;
  readonly customerAccountId: CustomerAccountId;
}

export class SendCustomerEraseOtpUseCase {
  constructor(private readonly dependencies: CustomerAuthDependencies) {}

  async execute(input: SendCustomerEraseOtpInput): Promise<CustomerEraseOtpSendResponse> {
    const { limiter, accounts, challenges, unitOfWork, events, clock, otpSecret } =
      this.dependencies;
    const account = await accounts.findById(input.customerAccountId);
    if (account === undefined) throw otpInvalid();
    if (!account.isActive()) throw customerAccountBlocked();

    const rule = CUSTOMER_OTP_RULES.sendsPerPhone;
    const decision = await limiter.consume({
      bucket: OTP_SEND_PHONE_BUCKET,
      key: `${input.organizationId}:${account.phoneE164}`,
      limit: rule.limit,
      windowSeconds: rule.windowSeconds,
    });
    if (!decision.allowed) throw tooManyCodes(decision.retryAfterSeconds);

    const expiresInSeconds = CUSTOMER_OTP_RULES.expiresInSeconds;
    const code = generateOtpCode();
    const expiresAt = new Date(clock.now().getTime() + expiresInSeconds * MILLISECONDS_PER_SECOND);
    const challenge: OtpChallenge = {
      otpChallengeId: newId(),
      phoneE164: account.phoneE164,
      codeHash: hashOtpCode(otpSecret, account.phoneE164, code),
      codeCiphertext: sealOtpCode(otpSecret, code),
      attempts: 0,
      expiresAt,
      consumedAt: undefined,
      purpose: CUSTOMER_OTP_PURPOSE.ERASE_ACCOUNT,
    };
    await unitOfWork.run(async () => {
      await challenges.replaceForPhone(challenge);
      await events.publish(CONTACT_EVENT_TYPE.CUSTOMER_OTP_REQUESTED, {
        otpChallengeId: challenge.otpChallengeId,
      });
    });
    return {
      challengeId: challenge.otpChallengeId,
      expiresAt: challenge.expiresAt.toISOString(),
    };
  }
}
