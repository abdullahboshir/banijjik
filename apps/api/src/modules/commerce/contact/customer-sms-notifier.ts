import type { StorefrontConfig } from "../../../config/index.js";
import { registerEventHandler } from "../../../kernel/events/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import {
  createCustomerSmsNotifier,
  createDisabledCustomerSmsNotifier,
} from "./application/customer-sms-notifier.js";
import type {
  CustomerSmsNotifier,
  OtpMessageComposer,
  SmsSender,
} from "./application/ports/customer-account-ports.js";
import { buildSendCustomerOtpSmsHandler } from "./application/send-customer-otp-sms.handler.js";
import { MongoCustomerAccountRepository } from "./infrastructure/mongo-customer-account.repository.js";
import { MongoCustomerSmsSentRepository } from "./infrastructure/mongo-customer-sms-sent.repository.js";
import { MongoOtpChallengeRepository } from "./infrastructure/mongo-otp-challenge.repository.js";
import { DisabledSmsSender, TestInboxSmsSender } from "./infrastructure/sms-senders.js";

export interface ContactEventHandlerDependencies {
  readonly storefront: Pick<StorefrontConfig, "otpSecret" | "smsDriver">;
  readonly composer: OtpMessageComposer;
}

function buildSmsSender(driver: StorefrontConfig["smsDriver"]): SmsSender {
  return driver === "test-inbox" ? new TestInboxSmsSender() : new DisabledSmsSender();
}

/**
 * The transactional SMS notifier another module calls through this module's index (M.8b). With the
 * disabled driver it is a no-op that logs, so a review never fails because no provider is configured.
 * The optional sender lets a test prove that a failed send rolls the dedupe record back.
 */
export function buildCustomerSmsNotifier(input: {
  readonly smsDriver: StorefrontConfig["smsDriver"];
  readonly clock: Clock;
  readonly sender?: SmsSender;
}): CustomerSmsNotifier {
  const sender =
    input.sender ?? (input.smsDriver === "disabled" ? undefined : buildSmsSender(input.smsDriver));
  if (sender === undefined) return createDisabledCustomerSmsNotifier();
  return createCustomerSmsNotifier({
    accounts: new MongoCustomerAccountRepository(),
    records: new MongoCustomerSmsSentRepository(),
    sender,
    clock: input.clock,
  });
}

/** Registers the event handlers of the contact module. The worker calls it before it starts (ADR-090). */
export function registerContactEventHandlers(dependencies: ContactEventHandlerDependencies): void {
  registerEventHandler(
    buildSendCustomerOtpSmsHandler({
      challenges: new MongoOtpChallengeRepository(),
      sender: buildSmsSender(dependencies.storefront.smsDriver),
      composer: dependencies.composer,
      otpSecret: dependencies.storefront.otpSecret,
    }),
  );
}
