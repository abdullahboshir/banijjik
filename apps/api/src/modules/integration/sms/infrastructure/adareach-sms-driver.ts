import { createHash } from "node:crypto";
import { SMS_FAILURE_REASON, SMS_OUTCOME, type SmsFailureReason } from "@banijjik/contracts/sms";
import { SmsTransientError, type SmsDriver, type SmsDriverResult } from "../application/ports.js";
import { containsUnicode, numericCode, smsPost } from "./sms-http.js";

const TOKEN_TTL_MS = 55 * 60 * 1000;
const TRANSIENT_CODES = new Set([1502, 1510, 1512, 1002]);
const FAILURE_REASONS: Readonly<Record<number, SmsFailureReason>> = {
  1508: SMS_FAILURE_REASON.AUTH_FAILED,
  1501: SMS_FAILURE_REASON.AUTH_FAILED,
  1503: SMS_FAILURE_REASON.SENDER_NOT_ALLOWED,
  1506: SMS_FAILURE_REASON.BALANCE_LOW,
  1202: SMS_FAILURE_REASON.INVALID_NUMBER,
  1001: SMS_FAILURE_REASON.INVALID_NUMBER,
  1509: SMS_FAILURE_REASON.NOT_ALLOWED,
  1201: SMS_FAILURE_REASON.NOT_ALLOWED,
  1203: SMS_FAILURE_REASON.NOT_ALLOWED,
  1204: SMS_FAILURE_REASON.NOT_ALLOWED,
};
interface Credentials {
  baseUrl: string;
  username: string;
  password: string;
  senderId: string;
}
interface Token {
  value: string;
  expiresAt: number;
}

export class AdaReachSmsDriver implements SmsDriver {
  private readonly tokens = new Map<string, Token>();
  constructor(private readonly credentials: Credentials) {}

  private cacheKey(): string {
    return createHash("sha256")
      .update(`${this.credentials.baseUrl}:${this.credentials.username}`)
      .digest("hex");
  }

  private async login(): Promise<string | SmsDriverResult> {
    const cached = this.tokens.get(this.cacheKey());
    if (cached !== undefined && cached.expiresAt > Date.now()) return cached.value;
    const response = await smsPost(`${this.credentials.baseUrl}/auth/tokens`, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: this.credentials.username,
        password: this.credentials.password,
      }),
    });
    const code = numericCode(response.body["errorCode"]);
    if (code !== null && TRANSIENT_CODES.has(code)) throw new SmsTransientError();
    const token = response.body["token"];
    if (response.status >= 400 || typeof token !== "string" || token.length === 0) {
      return {
        outcome: SMS_OUTCOME.REFUSED,
        failureReason: SMS_FAILURE_REASON.AUTH_FAILED,
        providerErrorCode: code,
      };
    }
    this.tokens.set(this.cacheKey(), { value: token, expiresAt: Date.now() + TOKEN_TTL_MS });
    return token;
  }

  private async sendOnce(input: { msisdn: string; text: string }, token: string) {
    return smsPost(`${this.credentials.baseUrl}/sms/send`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        sender: this.credentials.senderId,
        receiver: [input.msisdn],
        content: input.text,
        msgType: "T",
        requestType: "S",
        contentType: containsUnicode(input.text) ? 2 : 1,
      }),
    });
  }

  async send(input: { msisdn: string; text: string }): Promise<SmsDriverResult> {
    const token = await this.login();
    if (typeof token !== "string") return token;
    return providerResult(await this.sendWithRelogin(input, token));
  }

  private async sendWithRelogin(input: { msisdn: string; text: string }, token: string) {
    const response = await this.sendOnce(input, token);
    if (response.status === 401) {
      this.tokens.delete(this.cacheKey());
      const fresh = await this.login();
      if (typeof fresh !== "string") return { status: 401, body: { errorCode: 1508 } };
      return this.sendOnce(input, fresh);
    }
    return response;
  }
}

function providerResult(response: {
  status: number;
  body: Record<string, unknown>;
}): SmsDriverResult {
  const code = numericCode(response.body["errorCode"]);
  if (code !== null && TRANSIENT_CODES.has(code)) throw new SmsTransientError();
  if (!isSuccessful(response, code)) return refusedResult(response.status, code);
  return sentResult(response.body);
}

function isSuccessful(
  response: { status: number; body: Record<string, unknown> },
  code: number | null,
): boolean {
  return response.status < 400 && response.body["status"] === "SUCCESS" && code === 0;
}

function sentResult(body: Record<string, unknown>): SmsDriverResult {
  const messageId = body["messageId"];
  const providerMessageId =
    typeof messageId === "string" || typeof messageId === "number" ? String(messageId) : null;
  return { outcome: SMS_OUTCOME.SENT, parts: numericCode(body["msgCount"]), providerMessageId };
}

function refusedResult(status: number, code: number | null): SmsDriverResult {
  const failureReason =
    status === 401
      ? SMS_FAILURE_REASON.AUTH_FAILED
      : (FAILURE_REASONS[code ?? 0] ?? SMS_FAILURE_REASON.PROVIDER_REFUSED);
  return { outcome: SMS_OUTCOME.REFUSED, failureReason, providerErrorCode: code };
}
