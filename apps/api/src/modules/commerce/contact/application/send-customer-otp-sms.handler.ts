import { SMS_PURPOSE } from "@banijjik/contracts/sms";
import { MODULE_KEY } from "@banijjik/contracts";
import { CONTACT_EVENT_TYPE } from "@banijjik/contracts/contact";
import type { EventHandler } from "../../../../kernel/events/index.js";
import { openOtpCode } from "./customer-otp-codec.js";
import type {
  OtpChallengeRepository,
  OtpMessageComposer,
  SmsSender,
} from "./ports/customer-account-ports.js";

export interface SendCustomerOtpSmsDependencies {
  readonly challenges: OtpChallengeRepository;
  readonly sender: SmsSender;
  readonly composer: OtpMessageComposer;
  /** `OTP_SECRET`: opens the sealed code. Never logged. */
  readonly otpSecret: string;
}

/**
 * Sends the sign-in code by SMS after the request committed (ADR-090, ADR-119). The event carries
 * only the challenge id; the code is opened here, sent, and the sealed copy removed. A repeated
 * delivery finds no sealed code and sends nothing, so a retry never costs a second SMS.
 */
export function buildSendCustomerOtpSmsHandler(
  dependencies: SendCustomerOtpSmsDependencies,
): EventHandler<typeof CONTACT_EVENT_TYPE.CUSTOMER_OTP_REQUESTED> {
  const { challenges, sender, composer, otpSecret } = dependencies;
  return {
    handlerKey: "contact.sendCustomerOtp",
    moduleKey: MODULE_KEY.CONTACT,
    eventType: CONTACT_EVENT_TYPE.CUSTOMER_OTP_REQUESTED,
    ordering: "UNORDERED",
    async handle(envelope) {
      const challenge = await challenges.findById(envelope.payload.otpChallengeId);
      if (challenge?.codeCiphertext === undefined) return;
      const code = openOtpCode(otpSecret, challenge.codeCiphertext);
      const text = await composer.compose(code, challenge.purpose);
      await sender.send({
        phoneE164: challenge.phoneE164,
        text,
        purpose: SMS_PURPOSE.CUSTOMER_OTP,
      });
      await challenges.clearCode(challenge.otpChallengeId);
    },
  };
}
