import {
  SMS_FAILURE_REASON,
  SMS_OUTCOME,
  SMS_PROVIDER,
  type SmsFailureReason,
  type SmsOutcome,
  type SmsProvider,
} from "@banijjik/contracts/sms";
import type { Translator } from "@banijjik/i18n";

/**
 * Every text of the platform SMS page, drawn on the server and passed to the client form as props. The
 * outcome and failure texts are the bundled `sms.outcome.*` and `sms.failure.*` keys.
 */
export interface PlatformSmsLabels {
  readonly title: string;
  readonly subtitle: string;
  readonly sendsNow: string;
  readonly notSetUp: string;
  readonly enabled: string;
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
  readonly test: {
    title: string;
    help: string;
    phone: string;
    phoneHint: string;
    send: string;
    sending: string;
    noAnswer: string;
  };
  readonly outcomeNames: Record<SmsOutcome, string>;
  readonly failureNames: Record<SmsFailureReason, string>;
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

export function platformSmsLabelsOf(t: Translator["t"]): PlatformSmsLabels {
  return {
    title: t("platform.sms.title"),
    subtitle: t("platform.sms.subtitle"),
    sendsNow: t("platform.sms.sendsNow"),
    notSetUp: t("platform.sms.notSetUp"),
    enabled: t("platform.sms.enabled"),
    provider: t("platform.sms.provider"),
    providerNone: t("platform.sms.providerNone"),
    providerNames: {
      [SMS_PROVIDER.ADAREACH]: t("platform.sms.provider.ADAREACH"),
      [SMS_PROVIDER.BULKSMSBD]: t("platform.sms.provider.BULKSMSBD"),
    },
    adareach: {
      username: t("platform.sms.adareach.username"),
      password: t("platform.sms.adareach.password"),
      senderId: t("platform.sms.adareach.senderId"),
    },
    bulksmsbd: {
      apiKey: t("platform.sms.bulksmsbd.apiKey"),
      senderId: t("platform.sms.bulksmsbd.senderId"),
    },
    secret: {
      saved: t("platform.sms.secret.saved"),
      notSaved: t("platform.sms.secret.notSaved"),
      hint: t("platform.sms.secret.hint"),
    },
    save: t("platform.sms.save"),
    saving: t("platform.sms.saving"),
    saved: t("platform.sms.saved"),
    readOnly: t("platform.sms.readOnly"),
    conflict: t("platform.sms.conflict"),
    reload: t("platform.sms.reload"),
    incomplete: t("platform.sms.incomplete"),
    test: {
      title: t("platform.sms.test.title"),
      help: t("platform.sms.test.help"),
      phone: t("platform.sms.test.phone"),
      phoneHint: t("platform.sms.test.phoneHint"),
      send: t("platform.sms.test.send"),
      sending: t("platform.sms.test.sending"),
      noAnswer: t("platform.sms.test.noAnswer"),
    },
    outcomeNames: outcomeNamesOf(t),
    failureNames: failureNamesOf(t),
  };
}
