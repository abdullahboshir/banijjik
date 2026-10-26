import { ERROR_CODE } from "@banijjik/contracts";
import { SMS_OUTCOME, SMS_RULE_KEY, SMS_SOURCE } from "@banijjik/contracts/sms";
import type { SmsGatewayInput } from "@banijjik/validation/sms";
import type { RateLimiter } from "../../../../kernel/rate-limit/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import { AppError } from "../../../../kernel/http/index.js";
import { withTransaction } from "../../../../kernel/db/index.js";
import { isComplete, type Gateway } from "../domain/gateway.js";
import { gatewayView, changedFieldNames, type GatewayView } from "./gateway-settings.js";
import { SmsTransientError } from "./ports.js";
import { resolveGateway, type SmsResult } from "./sms-service.js";

export interface GatewayUseCaseDependencies {
  readonly repository: {
    gateway(platform: boolean): Promise<Gateway>;
    save(
      input: SmsGatewayInput,
      platform: boolean,
      now: Date,
    ): Promise<{ readonly gateway: Gateway; readonly entityId: string }>;
  };
  readonly clock: Clock;
  readonly limiter: RateLimiter;
  readonly platform: boolean;
  readonly subject: () => string;
  readonly audit: (tested: boolean, fields: readonly string[], entityId?: string) => Promise<void>;
  readonly message: () => Promise<string>;
  readonly tester: (phoneE164: string, text: string) => Promise<SmsResult>;
}

export class GatewayUseCases {
  constructor(private readonly dependencies: GatewayUseCaseDependencies) {}

  async read(): Promise<GatewayView & { readonly source: "ORGANIZATION" | "PLATFORM" | "NONE" }> {
    const { repository, platform, subject } = this.dependencies;
    const gateway = await repository.gateway(platform);
    const source = platform
      ? platformSource(gateway)
      : (await resolveGateway(repository, subject())).source;
    return { ...gatewayView(gateway), source };
  }

  async save(
    input: SmsGatewayInput,
  ): Promise<GatewayView & { readonly source: "ORGANIZATION" | "PLATFORM" | "NONE" }> {
    const { repository, platform, clock, audit } = this.dependencies;
    await withTransaction(async () => {
      const saved = await repository.save(input, platform, clock.now());
      await audit(false, changedFieldNames(input), saved.entityId);
    });
    return this.read();
  }

  async test(phoneE164: string): Promise<{ result: SmsResult; status: number }> {
    const { limiter, platform, subject, audit, message, tester } = this.dependencies;
    const decision = await limiter.consume({
      bucket: platform ? "sms.platform.test" : "sms.organization.test",
      key: subject(),
      limit: 5,
      windowSeconds: 3600,
    });
    if (!decision.allowed)
      throw new AppError({
        code: ERROR_CODE.RATE_LIMITED,
        details: { ruleKey: SMS_RULE_KEY.TEST_LIMIT },
        retryAfterSeconds: decision.retryAfterSeconds,
      });
    await withTransaction(() => audit(true, []));
    try {
      const text = await message();
      const result = await tester(phoneE164, text);
      return { result, status: 200 };
    } catch (error) {
      if (!(error instanceof SmsTransientError)) throw error;
      const source = platform
        ? SMS_SOURCE.PLATFORM
        : (await resolveGateway(this.dependencies.repository, subject())).source;
      return {
        result: {
          source,
          provider: null,
          outcome: SMS_OUTCOME.REFUSED,
          failureReason: null,
          providerErrorCode: null,
        },
        status: 502,
      };
    }
  }
}

function platformSource(gateway: Gateway): typeof SMS_SOURCE.PLATFORM | typeof SMS_SOURCE.NONE {
  if (gateway.enabled && isComplete(gateway)) return SMS_SOURCE.PLATFORM;
  return SMS_SOURCE.NONE;
}
