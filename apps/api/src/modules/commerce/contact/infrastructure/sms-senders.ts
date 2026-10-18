import { ERROR_CODE } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import { AppError } from "../../../../kernel/http/index.js";
import type { SmsSender } from "../application/ports/customer-account-ports.js";
import {
  SMS_TEST_MESSAGE_MODEL_NAME,
  type SmsTestMessageDocument,
} from "./customer-account.schema.js";

/**
 * Development and tests: the message is written to the `sms_test_messages` collection instead of
 * being sent. It never logs the text, which contains the code (ADR-119).
 */
export class TestInboxSmsSender implements SmsSender {
  async send(message: { readonly phoneE164: string; readonly text: string }): Promise<void> {
    await models({})
      .get<SmsTestMessageDocument>(SMS_TEST_MESSAGE_MODEL_NAME)
      .create(
        [{ smsTestMessageId: newId(), phoneE164: message.phoneE164, text: message.text }],
        sessionOption(getActiveSession()),
      );
  }
}

/** `SMS_DRIVER=disabled`: customer sign-in is off, so reaching this is a configuration bug and fails loudly. */
export class DisabledSmsSender implements SmsSender {
  send(): Promise<void> {
    return Promise.reject(new AppError({ code: ERROR_CODE.INTERNAL }));
  }
}
