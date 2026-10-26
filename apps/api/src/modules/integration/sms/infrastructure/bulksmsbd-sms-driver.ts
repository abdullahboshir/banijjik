import { SMS_FAILURE_REASON, SMS_OUTCOME, type SmsFailureReason } from "@banijjik/contracts/sms";
import type { SmsDriver, SmsDriverResult } from "../application/ports.js";
import { containsUnicode, numericCode, smsPost, SMS_HTTP_TIMEOUT_MS } from "./sms-http.js";

// Live-provider verification is required in the M.9 B Bangla pilot before launch.
const UNICODE_FLAG = "unicode";
const FAILURE_REASONS: Readonly<Record<number, SmsFailureReason>> = {
  1011: SMS_FAILURE_REASON.AUTH_FAILED,
  1002: SMS_FAILURE_REASON.SENDER_NOT_ALLOWED,
  1005: SMS_FAILURE_REASON.SENDER_NOT_ALLOWED,
  1013: SMS_FAILURE_REASON.SENDER_NOT_ALLOWED,
  1014: SMS_FAILURE_REASON.SENDER_NOT_ALLOWED,
  1015: SMS_FAILURE_REASON.SENDER_NOT_ALLOWED,
  1006: SMS_FAILURE_REASON.BALANCE_LOW,
  1007: SMS_FAILURE_REASON.BALANCE_LOW,
  1001: SMS_FAILURE_REASON.INVALID_NUMBER,
  1032: SMS_FAILURE_REASON.IP_NOT_WHITELISTED,
};

export class BulkSmsBdSmsDriver implements SmsDriver {
  constructor(
    private readonly credentials: { baseUrl: string; apiKey: string; senderId: string },
    private readonly timeoutMs = SMS_HTTP_TIMEOUT_MS,
  ) {}

  async send(input: { msisdn: string; text: string }): Promise<SmsDriverResult> {
    const body = new URLSearchParams({
      api_key: this.credentials.apiKey,
      type: containsUnicode(input.text) ? UNICODE_FLAG : "text",
      number: input.msisdn,
      senderid: this.credentials.senderId,
      message: input.text,
    });
    const response = await smsPost(
      `${this.credentials.baseUrl}/smsapi`,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
      this.timeoutMs,
    );
    const code = numericCode(response.body["response_code"]);
    if (response.status < 400 && code === 202) {
      return { outcome: SMS_OUTCOME.SENT, parts: null, providerMessageId: null };
    }
    return {
      outcome: SMS_OUTCOME.REFUSED,
      failureReason: FAILURE_REASONS[code ?? 0] ?? SMS_FAILURE_REASON.PROVIDER_REFUSED,
      providerErrorCode: code,
    };
  }
}
