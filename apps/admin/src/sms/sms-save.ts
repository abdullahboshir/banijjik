import { SMS_RULE_KEY } from "@banijjik/contracts/sms";
import type { SmsGatewayInput } from "@banijjik/validation/sms";
import { ApiError } from "../lib/api/api-error";
import { failureOfApiError, type FormFailure } from "../settings/form-failure";
import { saveSmsGateway, testSmsGateway, type SmsTestResult } from "./sms-api";

/** The form's fields as the API names them in a validation error. */
const SAVE_FIELD_NAMES: readonly string[] = [];
const TEST_FIELD_NAMES: readonly string[] = ["phoneE164"];

/** `incomplete`: an enabled provider with a field missing (the rule key names it; the text comes from the screen labels). */
export type SmsSaveOutcome =
  { kind: "saved" } | { kind: "incomplete" } | { kind: "refused"; failure: FormFailure };

export type SmsTestOutcome =
  | { kind: "answered"; result: SmsTestResult }
  | { kind: "no-answer" }
  | { kind: "refused"; failure: FormFailure };

/** An enabled provider with a field missing is refused with its own rule key, so the person sees which step is missing. */
function isIncompleteRefusal(error: ApiError): boolean {
  return error.details?.["ruleKey"] === SMS_RULE_KEY.GATEWAY_INCOMPLETE;
}

export async function saveSmsSettings(
  organizationId: string,
  body: SmsGatewayInput,
): Promise<SmsSaveOutcome> {
  try {
    await saveSmsGateway(organizationId, body);
    return { kind: "saved" };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (isIncompleteRefusal(error)) return { kind: "incomplete" };
    return { kind: "refused", failure: failureOfApiError(error, SAVE_FIELD_NAMES) };
  }
}

/** A 502 is the gateway not answering; the body then carries no outcome, so the screen says so in words. */
function isNoAnswer(error: ApiError): boolean {
  return error.status === 502;
}

export async function sendSmsTest(
  organizationId: string,
  phoneE164: string,
): Promise<SmsTestOutcome> {
  try {
    const result = await testSmsGateway(organizationId, phoneE164);
    return { kind: "answered", result };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (isNoAnswer(error)) return { kind: "no-answer" };
    return { kind: "refused", failure: failureOfApiError(error, TEST_FIELD_NAMES) };
  }
}
