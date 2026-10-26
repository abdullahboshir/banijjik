import { ERROR_CODE, LIMIT_KEY } from "@banijjik/contracts";
import { SMS_OUTCOME, SMS_PURPOSE, SMS_SOURCE } from "@banijjik/contracts/sms";
import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../../../../kernel/http/index.js";
import { createLogger, setRootLogger } from "../../../../kernel/logger/index.js";
import { MutableClock } from "../../../../test-support/mutable-clock.js";
import {
  businessDate,
  resolveGateway,
  SmsService,
  type SmsLogEntry,
  type SmsRepository,
} from "./sms-service.js";
import { emptyGateway, type Gateway } from "../domain/gateway.js";

const NOW = new Date("2026-10-25T19:00:00.000Z");
const organizationGateway: Gateway = {
  ...emptyGateway(),
  enabled: true,
  activeProvider: "BULKSMSBD",
  bulksmsbd: { senderId: "MASK", apiKeySealed: "sealed" },
  version: 2,
};
const platformGateway: Gateway = { ...organizationGateway, version: 3 };
const context = { organizationId: "019a0000-0000-7000-8000-000000000001" };

function repository(
  rows: SmsLogEntry[] = [],
  overrides: { own?: Gateway; platform?: Gateway; sent?: number } = {},
): SmsRepository {
  return {
    async gateway(platform) {
      return platform ? (overrides.platform ?? emptyGateway()) : (overrides.own ?? emptyGateway());
    },
    async append(entry) {
      rows.push(entry);
    },
    async countSent() {
      return overrides.sent ?? 0;
    },
  };
}

function service(input: { repo: SmsRepository; denied?: boolean; onDriverCall?: () => void }) {
  const clock = new MutableClock(NOW);
  const monthlyChecks: Array<[string, number]> = [];
  const instance = new SmsService({
    repository: input.repo,
    clock,
    limits: {
      async assertBelow(key, count) {
        monthlyChecks.push([key, count]);
        if (input.denied) throw new AppError({ code: ERROR_CODE.LIMIT_REACHED });
      },
    },
    policy: {
      async read() {
        return { dailyLimit: 10, timeZone: "Asia/Dhaka" };
      },
    },
    driver: () => ({
      async send() {
        input.onDriverCall?.();
        return { outcome: "SENT" as const, parts: 2, providerMessageId: "provider-1" };
      },
    }),
    organizationId: () => context.organizationId,
  });
  return { instance, monthlyChecks, clock };
}

beforeEach(() => setRootLogger(createLogger({ level: "info", destination: { write() {} } })));

describe("SMS gateway selection and cost guards", () => {
  it("prefers the organization's complete gateway over the platform default", async () => {
    await expect(
      resolveGateway(
        { gateway: async (platform) => (platform ? platformGateway : organizationGateway) },
        context.organizationId,
      ),
    ).resolves.toMatchObject({ source: SMS_SOURCE.ORGANIZATION, gateway: organizationGateway });
  });

  it("falls back to the platform gateway when the organization is disabled or incomplete", async () => {
    const disabled = { ...organizationGateway, enabled: false };
    await expect(
      resolveGateway(
        { gateway: async (platform) => (platform ? platformGateway : disabled) },
        context.organizationId,
      ),
    ).resolves.toMatchObject({ source: SMS_SOURCE.PLATFORM });
    const incomplete = { ...organizationGateway, bulksmsbd: null };
    await expect(
      resolveGateway(
        { gateway: async (platform) => (platform ? platformGateway : incomplete) },
        context.organizationId,
      ),
    ).resolves.toMatchObject({ source: SMS_SOURCE.PLATFORM });
  });

  it("logs NOT_CONFIGURED and resolves without calling a provider", async () => {
    const rows: SmsLogEntry[] = [];
    let driverCalled = false;
    const subject = service({
      repo: repository(rows),
      onDriverCall: () => {
        driverCalled = true;
      },
    });
    const result = await subject.instance.sendWithResult({
      phoneE164: "+8801712345678",
      text: "secret message",
      purpose: SMS_PURPOSE.CUSTOMER_OTP,
    });
    expect(result.outcome).toBe(SMS_OUTCOME.NOT_CONFIGURED);
    expect(driverCalled).toBe(false);
    expect(rows[0]).toMatchObject({ phoneLastDigits: "678", source: SMS_SOURCE.NONE });
    expect(JSON.stringify(rows)).not.toContain("secret message");
  });

  it("refuses a non-Bangladesh number without calling the provider", async () => {
    const rows: SmsLogEntry[] = [];
    let driverCalled = false;
    const subject = service({
      repo: repository(rows, { own: organizationGateway }),
      onDriverCall: () => {
        driverCalled = true;
      },
    });
    await expect(
      subject.instance.sendWithResult({
        phoneE164: "+14155550123",
        text: "private",
        purpose: SMS_PURPOSE.CUSTOMER_OTP,
      }),
    ).resolves.toMatchObject({ outcome: SMS_OUTCOME.REFUSED, failureReason: "INVALID_NUMBER" });
    expect(rows).toHaveLength(1);
    expect(driverCalled).toBe(false);
  });

  it("uses the organization's local business date across Dhaka midnight", () => {
    expect(businessDate(NOW, "Asia/Dhaka")).toBe("2026-10-26");
  });

  it("skips at the daily cap and logs the organization local date", async () => {
    const rows: SmsLogEntry[] = [];
    const subject = service({ repo: repository(rows, { own: organizationGateway, sent: 10 }) });
    await expect(
      subject.instance.sendWithResult({
        phoneE164: "+8801712345678",
        text: "hidden",
        purpose: SMS_PURPOSE.CUSTOMER_OTP,
      }),
    ).resolves.toMatchObject({ outcome: SMS_OUTCOME.SKIPPED_DAILY_LIMIT });
    expect(rows[0]).toMatchObject({ businessDate: "2026-10-26", source: SMS_SOURCE.ORGANIZATION });
  });

  it("checks smsPerMonth only for platform-paid sends", async () => {
    const own = service({ repo: repository([], { own: organizationGateway }) });
    await own.instance.sendWithResult({
      phoneE164: "+8801712345678",
      text: "hello",
      purpose: SMS_PURPOSE.CUSTOMER_OTP,
    });
    expect(own.monthlyChecks).toEqual([]);
    const platform = service({ repo: repository([], { platform: platformGateway }) });
    await platform.instance.sendWithResult({
      phoneE164: "+8801712345678",
      text: "hello",
      purpose: SMS_PURPOSE.CUSTOMER_OTP,
    });
    expect(platform.monthlyChecks).toEqual([[LIMIT_KEY.SMS_PER_MONTH, 0]]);
  });

  it("logs SKIPPED_MONTHLY_LIMIT without calling the provider when the platform quota is exhausted", async () => {
    const rows: SmsLogEntry[] = [];
    let driverCalled = false;
    const subject = service({
      repo: repository(rows, { platform: platformGateway }),
      denied: true,
      onDriverCall: () => {
        driverCalled = true;
      },
    });
    await expect(
      subject.instance.sendWithResult({
        phoneE164: "+8801712345678",
        text: "hello",
        purpose: SMS_PURPOSE.CUSTOMER_OTP,
      }),
    ).resolves.toMatchObject({ outcome: SMS_OUTCOME.SKIPPED_MONTHLY_LIMIT });
    expect(rows[0]?.source).toBe(SMS_SOURCE.PLATFORM);
    expect(driverCalled).toBe(false);
  });
});
