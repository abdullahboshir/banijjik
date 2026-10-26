import type { SmsFailureReason } from "@banijjik/contracts/sms";

export type SmsDriverResult =
  | {
      readonly outcome: "SENT";
      readonly parts: number | null;
      readonly providerMessageId: string | null;
    }
  | {
      readonly outcome: "REFUSED";
      readonly failureReason: SmsFailureReason;
      readonly providerErrorCode: number | null;
    };

export interface SmsDriver {
  send(input: { readonly msisdn: string; readonly text: string }): Promise<SmsDriverResult>;
}

/** Carries no HTTP request, response, phone or message: safe for the worker's error capture. */
export class SmsTransientError extends Error {
  constructor() {
    super("SMS provider temporarily unavailable");
    this.name = "SmsTransientError";
  }
}
