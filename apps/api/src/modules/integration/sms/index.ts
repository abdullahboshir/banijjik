import type { PermissionMiddlewareFactory, LimitGuard } from "../../../kernel/access/index.js";
import type { PlatformPermissionMiddlewareFactory } from "../../../kernel/auth/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { Router } from "express";
import type { SmsConfig } from "../../../config/read-sms-config.js";
import { initializeSecretBox } from "../../../kernel/secrets/index.js";
import { SmsService } from "./application/sms-service.js";
import {
  GatewayUseCases,
  type GatewayUseCaseDependencies,
} from "./application/gateway-use-cases.js";
import { buildDriverFactory } from "./infrastructure/driver-factory.js";
import { MongoSmsRepository, organizationId } from "./infrastructure/mongo-sms.repository.js";
import { SMS_FAILURE_REASON, SMS_OUTCOME, SMS_PURPOSE, SMS_SOURCE } from "@banijjik/contracts/sms";
import { isBangladeshMobile, isComplete, type Gateway } from "./domain/gateway.js";
import type { SmsResult } from "./application/sms-service.js";
import type { SmsDriver } from "./application/ports.js";
import { SmsController } from "./presentation/sms.controller.js";
import { smsTenantRouter, smsPlatformRouter } from "./presentation/sms.router.js";

export { smsManifest } from "./module.manifest.js";
export { registerSmsModels } from "./infrastructure/register-sms-models.js";
export { organizationId };
export type { SmsResult, SmsLogEntry } from "./application/sms-service.js";
export { SmsTransientError } from "./application/ports.js";

export interface SmsModuleDependencies {
  readonly config: SmsConfig;
  readonly clock: Clock;
  readonly limits: LimitGuard;
  readonly policy: { read(): Promise<{ dailyLimit: number; timeZone: string }> };
}

export function buildGatewaySmsSender(dependencies: SmsModuleDependencies): SmsService {
  initializeSecretBox(dependencies.config.encryptionKey);
  return new SmsService({
    ...dependencies,
    repository: new MongoSmsRepository(),
    organizationId,
    driver: buildDriverFactory(dependencies.config),
  });
}

interface GatewayRouterDependencies {
  readonly config: SmsConfig;
  readonly clock: Clock;
  readonly limiter: GatewayUseCaseDependencies["limiter"];
  readonly audit: GatewayUseCaseDependencies["audit"];
  readonly message: GatewayUseCaseDependencies["message"];
}

export function buildSmsTenantRouter(
  input: GatewayRouterDependencies &
    SmsModuleDependencies & { permission: PermissionMiddlewareFactory },
): Router {
  initializeSecretBox(input.config.encryptionKey);
  const repository = new MongoSmsRepository();
  const service = buildGatewaySmsSender(input);
  const useCases = new GatewayUseCases({
    ...input,
    platform: false,
    subject: organizationId,
    repository,
    tester: (phoneE164, text) =>
      service.sendWithResult({ phoneE164, text, purpose: SMS_PURPOSE.GATEWAY_TEST }),
  });
  return smsTenantRouter(new SmsController(useCases, repository), input.permission);
}

export function buildSmsPlatformRouter(
  input: GatewayRouterDependencies & {
    permission: PlatformPermissionMiddlewareFactory;
    operatorId: () => string;
  },
): Router {
  initializeSecretBox(input.config.encryptionKey);
  const repository = new MongoSmsRepository();
  const driver = buildDriverFactory(input.config);
  const useCases = new GatewayUseCases({
    ...input,
    platform: true,
    subject: input.operatorId,
    repository,
    tester: (phoneE164, text) =>
      testPlatformGateway({
        repository,
        driver,
        phoneE164,
        text,
      }),
  });
  return smsPlatformRouter(new SmsController(useCases, repository), input.permission);
}

async function testPlatformGateway(input: {
  repository: MongoSmsRepository;
  driver: (gateway: Gateway, ownerId: string) => SmsDriver;
  phoneE164: string;
  text: string;
}): Promise<SmsResult> {
  const { repository, driver, phoneE164, text } = input;
  const gateway = await repository.gateway(true);
  const base: SmsResult = {
    source: SMS_SOURCE.PLATFORM,
    provider: gateway.activeProvider,
    outcome: SMS_OUTCOME.NOT_CONFIGURED,
    failureReason: null,
    providerErrorCode: null,
  };
  if (!gateway.enabled || !isComplete(gateway)) return { ...base, source: SMS_SOURCE.NONE };
  if (!isBangladeshMobile(phoneE164))
    return {
      ...base,
      outcome: SMS_OUTCOME.REFUSED,
      failureReason: SMS_FAILURE_REASON.INVALID_NUMBER,
    };
  return {
    ...base,
    ...(await driver(gateway, "platform").send({ msisdn: phoneE164.slice(1), text })),
  };
}
