import {
  SMS_FAILURE_REASON,
  SMS_OUTCOME,
  SMS_PROVIDER,
  SMS_PURPOSE,
  SMS_SOURCE,
  type SmsFailureReason,
  type SmsOutcome,
  type SmsProvider,
  type SmsPurpose,
  type SmsSource,
} from "@banijjik/contracts/sms";
import type { Translator } from "@banijjik/i18n";

/**
 * Every text of the SMS settings screens, drawn on the server. Client components receive these strings as
 * props, because the screen catalogs never reach the browser (13-UX section 11). The outcome and failure
 * texts are the bundled `sms.outcome.*` and `sms.failure.*` keys: one message per value, no raw code.
 */
export interface SmsSettingsLabels {
  readonly title: string;
  readonly subtitle: string;
  /** A template with `{via}`, filled with one of `sourceNames`. */
  readonly sendsVia: string;
  readonly sourceNames: Record<SmsSource, string>;
  readonly enabled: string;
  readonly enabledHint: string;
  readonly provider: string;
  readonly providerNone: string;
  readonly providerNames: Record<SmsProvider, string>;
  readonly adareach: { username: string; password: string; senderId: string };
  readonly bulksmsbd: { apiKey: string; senderId: string };
  readonly secret: { saved: string; notSaved: string; hint: string };
  readonly save: string;
  readonly saving: string;
  readonly saved: string;
  readonly readOnly: string;
  readonly conflict: string;
  readonly reload: string;
  readonly incomplete: string;
  readonly test: TestLabels;
  readonly logs: LogLabels;
  readonly purposeNames: Record<SmsPurpose, string>;
  readonly outcomeNames: Record<SmsOutcome, string>;
  readonly failureNames: Record<SmsFailureReason, string>;
}

export interface TestLabels {
  readonly title: string;
  readonly help: string;
  readonly phone: string;
  readonly phoneHint: string;
  readonly send: string;
  readonly sending: string;
  readonly noAnswer: string;
  /** A template with `{via}`. */
  readonly through: string;
}

export interface LogLabels {
  readonly title: string;
  readonly help: string;
  readonly empty: string;
  /** A template with `{digits}`. */
  readonly digits: string;
  readonly more: string;
  readonly loading: string;
  readonly failed: string;
}

function sourceNamesOf(t: Translator["t"]): Record<SmsSource, string> {
  return {
    [SMS_SOURCE.ORGANIZATION]: t("sms.via.ORGANIZATION"),
    [SMS_SOURCE.PLATFORM]: t("sms.via.PLATFORM"),
    [SMS_SOURCE.NONE]: t("sms.via.NONE"),
  };
}

function outcomeNamesOf(t: Translator["t"]): Record<SmsOutcome, string> {
  return {
    [SMS_OUTCOME.SENT]: t("sms.outcome.SENT"),
    [SMS_OUTCOME.REFUSED]: t("sms.outcome.REFUSED"),
    [SMS_OUTCOME.SKIPPED_DAILY_LIMIT]: t("sms.outcome.SKIPPED_DAILY_LIMIT"),
    [SMS_OUTCOME.SKIPPED_MONTHLY_LIMIT]: t("sms.outcome.SKIPPED_MONTHLY_LIMIT"),
    [SMS_OUTCOME.NOT_CONFIGURED]: t("sms.outcome.NOT_CONFIGURED"),
  };
}

function failureNamesOf(t: Translator["t"]): Record<SmsFailureReason, string> {
  return {
    [SMS_FAILURE_REASON.AUTH_FAILED]: t("sms.failure.AUTH_FAILED"),
    [SMS_FAILURE_REASON.SENDER_NOT_ALLOWED]: t("sms.failure.SENDER_NOT_ALLOWED"),
    [SMS_FAILURE_REASON.BALANCE_LOW]: t("sms.failure.BALANCE_LOW"),
    [SMS_FAILURE_REASON.INVALID_NUMBER]: t("sms.failure.INVALID_NUMBER"),
    [SMS_FAILURE_REASON.NOT_ALLOWED]: t("sms.failure.NOT_ALLOWED"),
    [SMS_FAILURE_REASON.IP_NOT_WHITELISTED]: t("sms.failure.IP_NOT_WHITELISTED"),
    [SMS_FAILURE_REASON.PROVIDER_REFUSED]: t("sms.failure.PROVIDER_REFUSED"),
  };
}

function purposeNamesOf(t: Translator["t"]): Record<SmsPurpose, string> {
  return {
    [SMS_PURPOSE.CUSTOMER_OTP]: t("sms.purpose.CUSTOMER_OTP"),
    [SMS_PURPOSE.LISTING_REVIEW_RESULT]: t("sms.purpose.LISTING_REVIEW_RESULT"),
    [SMS_PURPOSE.GATEWAY_TEST]: t("sms.purpose.GATEWAY_TEST"),
  };
}

function testLabelsOf(t: Translator["t"]): TestLabels {
  return {
    title: t("sms.test.title"),
    help: t("sms.test.help"),
    phone: t("sms.test.phone"),
    phoneHint: t("sms.test.phoneHint"),
    send: t("sms.test.send"),
    sending: t("sms.test.sending"),
    noAnswer: t("sms.test.noAnswer"),
    through: t("sms.test.through"),
  };
}

function logLabelsOf(t: Translator["t"]): LogLabels {
  return {
    title: t("sms.logs.title"),
    help: t("sms.logs.help"),
    empty: t("sms.logs.empty"),
    digits: t("sms.logs.digits"),
    more: t("sms.logs.more"),
    loading: t("sms.logs.loading"),
    failed: t("sms.logs.failed"),
  };
}

export function smsSettingsLabelsOf(t: Translator["t"]): SmsSettingsLabels {
  return {
    title: t("sms.settings.title"),
    subtitle: t("sms.settings.subtitle"),
    sendsVia: t("sms.settings.via"),
    sourceNames: sourceNamesOf(t),
    enabled: t("sms.settings.enabled"),
    enabledHint: t("sms.settings.enabledHint"),
    provider: t("sms.settings.provider"),
    providerNone: t("sms.settings.providerNone"),
    providerNames: {
      [SMS_PROVIDER.ADAREACH]: t("sms.provider.ADAREACH"),
      [SMS_PROVIDER.BULKSMSBD]: t("sms.provider.BULKSMSBD"),
    },
    adareach: {
      username: t("sms.settings.adareach.username"),
      password: t("sms.settings.adareach.password"),
      senderId: t("sms.settings.adareach.senderId"),
    },
    bulksmsbd: {
      apiKey: t("sms.settings.bulksmsbd.apiKey"),
      senderId: t("sms.settings.bulksmsbd.senderId"),
    },
    secret: {
      saved: t("sms.settings.secret.saved"),
      notSaved: t("sms.settings.secret.notSaved"),
      hint: t("sms.settings.secret.hint"),
    },
    save: t("sms.settings.save"),
    saving: t("sms.settings.saving"),
    saved: t("sms.settings.saved"),
    readOnly: t("sms.settings.readOnly"),
    conflict: t("sms.settings.conflict"),
    reload: t("sms.settings.reload"),
    incomplete: t("sms.settings.incomplete"),
    test: testLabelsOf(t),
    logs: logLabelsOf(t),
    purposeNames: purposeNamesOf(t),
    outcomeNames: outcomeNamesOf(t),
    failureNames: failureNamesOf(t),
  };
}
