import { createHash } from "node:crypto";
import { ERROR_CODE } from "@banijjik/contracts";
import { SMS_PROVIDER } from "@banijjik/contracts/sms";
import type { SmsConfig } from "../../../../config/read-sms-config.js";
import { AppError } from "../../../../kernel/http/index.js";
import { openSecret } from "../../../../kernel/secrets/index.js";
import type { SmsDriver } from "../application/ports.js";
import type { Gateway } from "../domain/gateway.js";
import { AdaReachSmsDriver } from "./adareach-sms-driver.js";
import { BulkSmsBdSmsDriver } from "./bulksmsbd-sms-driver.js";

/** Cache drivers by their sealed credentials, so rotation evicts an old token without storing plaintext in keys. */
export function buildDriverFactory(
  config: SmsConfig,
): (gateway: Gateway, ownerId: string) => SmsDriver {
  const drivers = new Map<string, SmsDriver>();
  return (gateway, ownerId) => {
    const cacheKey = createHash("sha256")
      .update(
        JSON.stringify({
          ownerId,
          provider: gateway.activeProvider,
          adareach: gateway.adareach,
          bulksmsbd: gateway.bulksmsbd,
        }),
      )
      .digest("hex");
    const cached = drivers.get(cacheKey);
    if (cached !== undefined) return cached;
    const driver = createDriver(config, gateway, ownerId);
    // Bounded per-process cache; an eviction only causes a new login.
    if (drivers.size >= 100) drivers.clear();
    drivers.set(cacheKey, driver);
    return driver;
  };
}

function createDriver(config: SmsConfig, gateway: Gateway, ownerId: string): SmsDriver {
  if (gateway.activeProvider === SMS_PROVIDER.ADAREACH && gateway.adareach !== null) {
    return new AdaReachSmsDriver({
      baseUrl: config.adareachBaseUrl,
      username: gateway.adareach.username,
      password: openSecret(gateway.adareach.passwordSealed, `sms:${ownerId}:adareach.password`),
      senderId: gateway.adareach.senderId,
    });
  }
  if (gateway.activeProvider === SMS_PROVIDER.BULKSMSBD && gateway.bulksmsbd !== null) {
    return new BulkSmsBdSmsDriver({
      baseUrl: config.bulksmsbdBaseUrl,
      apiKey: openSecret(gateway.bulksmsbd.apiKeySealed, `sms:${ownerId}:bulksmsbd.apiKey`),
      senderId: gateway.bulksmsbd.senderId,
    });
  }
  throw new AppError({ code: ERROR_CODE.INTERNAL });
}
