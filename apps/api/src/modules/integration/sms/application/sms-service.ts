import { ERROR_CODE, LIMIT_KEY } from "@banijjik/contracts";
import {
  SMS_FAILURE_REASON,
  SMS_OUTCOME,
  SMS_PURPOSE,
  SMS_SOURCE,
  type SmsOutcome,
  type SmsProvider,
  type SmsPurpose,
  type SmsSource,
  type SmsFailureReason,
} from "@banijjik/contracts/sms";
import { newId } from "@banijjik/ids";
import type { LimitGuard } from "../../../../kernel/access/index.js";
import { AppError } from "../../../../kernel/http/index.js";
import { getLogger } from "../../../../kernel/logger/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import { isComplete, type Gateway } from "../domain/gateway.js";
import type { SmsDriver } from "./ports.js";

export interface SmsResult {
  readonly outcome: SmsOutcome;
  readonly failureReason: SmsFailureReason | null;
  readonly providerErrorCode: number | null;
  readonly source: SmsSource;
  readonly provider: SmsProvider | null;
}
export interface SmsLogEntry extends SmsResult {
  readonly smsLogId: string;
  readonly purpose: SmsPurpose;
  readonly phoneLastDigits: string;
  readonly businessDate: string;
  readonly createdAt: Date;
  readonly parts: number | null;
  readonly providerMessageId: string | null;
}
export interface SmsRepository {
  gateway(platform: boolean): Promise<Gateway>;
  append(entry: SmsLogEntry): Promise<void>;
  countSent(from: string, to: string, source?: SmsSource): Promise<number>;
}
export interface SmsServiceDependencies {
  readonly repository: SmsRepository;
  readonly clock: Clock;
  readonly limits: LimitGuard;
  readonly policy: { read(): Promise<{ dailyLimit: number; timeZone: string }> };
  readonly driver: (gateway: Gateway, ownerId: string) => SmsDriver;
  readonly organizationId: () => string;
}
export interface Message {
  readonly phoneE164: string;
  readonly text: string;
  readonly purpose: SmsPurpose;
}
interface Selection {
  source: SmsSource;
  gateway: Gateway | null;
  ownerId: string;
}

export async function resolveGateway(
  repository: Pick<SmsRepository, "gateway">,
  organizationId: string,
): Promise<Selection> {
  const own = await repository.gateway(false);
  if (own.enabled && isComplete(own))
    return { source: SMS_SOURCE.ORGANIZATION, gateway: own, ownerId: organizationId };
  const platform = await repository.gateway(true);
  if (platform.enabled && isComplete(platform))
    return { source: SMS_SOURCE.PLATFORM, gateway: platform, ownerId: "platform" };
  return { source: SMS_SOURCE.NONE, gateway: null, ownerId: organizationId };
}

export function businessDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export class SmsService {
  constructor(private readonly dependencies: SmsServiceDependencies) {}

  async send(message: Message): Promise<void> {
    await this.sendWithResult(message);
  }

  async sendWithResult(message: Message): Promise<SmsResult> {
    const { repository, clock, policy, organizationId, driver } = this.dependencies;
    const selection = await resolveGateway(repository, organizationId());
    const settings = await policy.read();
    const date = businessDate(clock.now(), settings.timeZone);
    const base: SmsResult = {
      source: selection.source,
      provider: selection.gateway?.activeProvider ?? null,
      outcome: SMS_OUTCOME.NOT_CONFIGURED,
      failureReason: null,
      providerErrorCode: null,
    };
    const refused = this.invalidNumber(message, base);
    if (refused !== undefined) return this.record({ message, date, result: refused });
    if (selection.gateway === null) return this.record({ message, date, result: base });
    const skipped = await this.costGuard({ message, date, base, dailyLimit: settings.dailyLimit });
    if (skipped !== undefined) return this.record({ message, date, result: skipped });
    const result = await driver(selection.gateway, selection.ownerId).send({
      msisdn: message.phoneE164.slice(1),
      text: message.text,
    });
    return this.record({
      message,
      date,
      result: { ...base, ...result },
      ...(result.outcome === SMS_OUTCOME.SENT ? { metrics: result } : {}),
    });
  }

  private invalidNumber(message: Message, base: SmsResult): SmsResult | undefined {
    if (/^\+8801[3-9]\d{8}$/.test(message.phoneE164)) return undefined;
    return {
      ...base,
      outcome: SMS_OUTCOME.REFUSED,
      failureReason: SMS_FAILURE_REASON.INVALID_NUMBER,
    };
  }

  private async costGuard(input: {
    message: Message;
    date: string;
    base: SmsResult;
    dailyLimit: number;
  }): Promise<SmsResult | undefined> {
    const { message, date, base, dailyLimit } = input;
    if (message.purpose === SMS_PURPOSE.GATEWAY_TEST) return undefined;
    const { repository, limits } = this.dependencies;
    if ((await repository.countSent(date, date)) >= dailyLimit)
      return { ...base, outcome: SMS_OUTCOME.SKIPPED_DAILY_LIMIT };
    if (base.source !== SMS_SOURCE.PLATFORM) return undefined;
    try {
      await limits.assertBelow(
        LIMIT_KEY.SMS_PER_MONTH,
        await repository.countSent(`${date.slice(0, 7)}-01`, date, SMS_SOURCE.PLATFORM),
      );
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== ERROR_CODE.LIMIT_REACHED) throw error;
      return { ...base, outcome: SMS_OUTCOME.SKIPPED_MONTHLY_LIMIT };
    }
    return undefined;
  }

  private async record(input: {
    message: Message;
    date: string;
    result: SmsResult;
    metrics?: { parts: number | null; providerMessageId: string | null };
  }): Promise<SmsResult> {
    const { message, date, result, metrics } = input;
    const entry: SmsLogEntry = {
      ...result,
      smsLogId: newId(),
      purpose: message.purpose,
      phoneLastDigits: message.phoneE164.slice(-3),
      businessDate: date,
      createdAt: this.dependencies.clock.now(),
      parts: metrics?.parts ?? null,
      providerMessageId: metrics?.providerMessageId ?? null,
    };
    await this.dependencies.repository.append(entry);
    const fields = {
      smsLogId: entry.smsLogId,
      phoneLastDigits: entry.phoneLastDigits,
      outcome: entry.outcome,
      parts: entry.parts,
    };
    if (result.outcome === SMS_OUTCOME.SENT) getLogger().info(fields, "SMS submitted");
    else getLogger().warn(fields, "SMS not submitted");
    return result;
  }
}
