import { asId, type CustomerAccountId } from "@banijjik/ids";
import { getLogger } from "../../../../kernel/logger/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type {
  CustomerAccountRepository,
  CustomerSmsNotifier,
  CustomerSmsSentRepository,
  SmsSender,
} from "./ports/customer-account-ports.js";

export interface CustomerSmsNotifierDependencies {
  readonly accounts: Pick<CustomerAccountRepository, "findById">;
  readonly records: CustomerSmsSentRepository;
  readonly sender: SmsSender;
  readonly clock: Clock;
}

/**
 * Resolves the phone from the account, skips a blocked or erased account silently, and writes the
 * dedupe record before the send. The caller runs inside the event transaction, so a failed send
 * rolls the record back and the retry sends once (M.8b decision 3).
 */
export function createCustomerSmsNotifier(
  dependencies: CustomerSmsNotifierDependencies,
): CustomerSmsNotifier {
  const { accounts, records, sender, clock } = dependencies;
  return {
    async sendToCustomer(input) {
      const account = await accounts.findById(asId<CustomerAccountId>(input.customerAccountId));
      if (account === undefined) {
        logSkipped("ACCOUNT_MISSING", input);
        return;
      }
      if (!account.isActive()) {
        logSkipped("ACCOUNT_NOT_ACTIVE", input);
        return;
      }
      const isFirstTime = await records.claim({
        dedupeKey: input.dedupeKey,
        now: clock.now(),
      });
      if (!isFirstTime) return;
      await sender.send({ phoneE164: account.phoneE164, text: input.text });
    },
  };
}

/** `SMS_DRIVER=disabled`: nothing is sent and the event does not fail (M.8b decision 6). */
export function createDisabledCustomerSmsNotifier(): CustomerSmsNotifier {
  return {
    async sendToCustomer(input) {
      logSkipped("SMS_DISABLED", input);
    },
  };
}

/** The id and the dedupe key are enough to trace the run; the text never reaches a log line. */
function logSkipped(
  reason: "ACCOUNT_MISSING" | "ACCOUNT_NOT_ACTIVE" | "SMS_DISABLED",
  input: { readonly customerAccountId: string; readonly dedupeKey: string },
): void {
  getLogger().info(
    {
      event: "contact.customer_sms_skipped",
      reason,
      customerAccountId: input.customerAccountId,
      dedupeKey: input.dedupeKey,
    },
    "customer SMS not sent",
  );
}
