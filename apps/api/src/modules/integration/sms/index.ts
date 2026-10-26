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
import { SmsController } from "./presentation/sms.controller.js";
import { smsTenantRouter, smsPlatformRouter } from "./presentation/sms.router.js";

export { smsManifest } from "./module.manifest.js";
export { registerSmsModels } from "./infrastructure/register-sms-models.js";
export type { SmsResult, SmsLogEntry } from "./application/sms-service.js";

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

interface RouterDependencies extends SmsModuleDependencies {
  readonly limiter: GatewayUseCaseDependencies["limiter"];
  readonly audit: GatewayUseCaseDependencies["audit"];
  readonly message: GatewayUseCaseDependencies["message"];
}

function controller(input: RouterDependencies, platform: boolean, subject: () => string) {
  initializeSecretBox(input.config.encryptionKey);
  const repository = new MongoSmsRepository();
  const useCases = new GatewayUseCases({
    ...input,
    platform,
    subject,
    repository,
    service: buildGatewaySmsSender(input),
    driver: buildDriverFactory(input.config),
  });
  return new SmsController(useCases, repository);
}

export function buildSmsTenantRouter(
  input: RouterDependencies & { permission: PermissionMiddlewareFactory },
): Router {
  return smsTenantRouter(controller(input, false, organizationId), input.permission);
}

export function buildSmsPlatformRouter(
  input: RouterDependencies & {
    permission: PlatformPermissionMiddlewareFactory;
    operatorId: () => string;
  },
): Router {
  return smsPlatformRouter(controller(input, true, input.operatorId), input.permission);
}
