import { SALES_RULE_KEY } from "@banijjik/contracts/sales";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";

export interface RuleFailure {
  readonly message: string;
  readonly ruleKey: string | undefined;
}

type Translate = (key: string) => string;

/**
 * The API sends every sales refusal as a generic business-rule error with the real reason in
 * `details.ruleKey`, so the screen picks the specific message from the rule key.
 */
const RULE_MESSAGE_KEYS: Readonly<Record<string, string>> = {
  [SALES_RULE_KEY.ORDER_CONTACT_LOCKED_BY_PAYMENT]: "errors.order_contact_locked_by_payment",
  [SALES_RULE_KEY.ORDER_TOTAL_BELOW_PAID]: "errors.order_total_below_paid",
  [SALES_RULE_KEY.ORDER_CANCEL_NEEDS_CONTACT]: "errors.order_cancel_needs_contact",
  [SALES_RULE_KEY.KIND_NEEDS_BOOKING]: "errors.kind_needs_booking",
  [SALES_RULE_KEY.FULFILLMENT_METHOD_UNSUPPORTED]: "errors.fulfillment_method_unsupported",
  [SALES_RULE_KEY.ADVANCE_NEEDS_PAYMENTS]: "errors.advance_needs_payments",
  [SALES_RULE_KEY.CONTACT_PHONE_REQUIRED]: "errors.order_contact_phone_required",
  [SALES_RULE_KEY.ORDER_NEEDS_LINE]: "errors.order_needs_line",
  [SALES_RULE_KEY.PACKING_DISABLED]: "errors.packing_disabled",
};

export function messageOf(error: unknown, t: Translate): string {
  const ruleMessageKey = RULE_MESSAGE_KEYS[ruleKeyOf(error) ?? ""];
  if (ruleMessageKey !== undefined) return t(knownMessageKeyOrInternal(ruleMessageKey));
  if (error instanceof ApiError) return t(knownMessageKeyOrInternal(error.messageKey));
  if (error instanceof Error) return error.message;
  return t("errors.internal");
}

export function ruleKeyOf(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  const ruleKey = error.details?.["ruleKey"];
  return typeof ruleKey === "string" ? ruleKey : undefined;
}

export function failureOf(error: unknown, t: Translate): RuleFailure {
  return { message: messageOf(error, t), ruleKey: ruleKeyOf(error) };
}
