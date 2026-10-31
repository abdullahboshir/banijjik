import { ERROR_CODE } from "@banijjik/contracts";
import { CUSTOMER_LOGIN_SETTING_KEY } from "@banijjik/contracts/contact";
import type { RequestHandler } from "express";
import type { AppConfig } from "../config/index.js";
import {
  authenticateCustomer,
  authenticateCustomerOptional,
  cacheAccountStatus,
  createCustomerTokenVerifier,
} from "../kernel/auth/index.js";
import { getRequestContext } from "../kernel/context/index.js";
import { AppError } from "../kernel/http/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildCustomerAccountStatusReader } from "../modules/commerce/contact/index.js";
import { buildSettingsResolver } from "../modules/core/settings/index.js";
import type { StorefrontRouterInput } from "./storefront.js";

const ACCOUNT_STATUS_MAX_STALE_SECONDS = 60;

function notAvailable(): AppError {
  return new AppError({
    code: ERROR_CODE.NOT_FOUND,
    messageKey: "errors.storefront_not_available",
  });
}

export function customerLoginEnabled(
  input: StorefrontRouterInput,
): (organizationId: string) => Promise<boolean> {
  const resolver = buildSettingsResolver({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });
  const hasSms = input.config.storefront.smsDriver !== "disabled";
  return async (organizationId) => {
    if (!hasSms) return false;
    const res = await resolver.resolve(organizationId, { keys: [CUSTOMER_LOGIN_SETTING_KEY] });
    return res.get(CUSTOMER_LOGIN_SETTING_KEY)?.value === true;
  };
}

export function customerLoginSwitch(input: StorefrontRouterInput): RequestHandler {
  const isEnabled = customerLoginEnabled(input);
  return async (_request, _response, next) => {
    const { organizationId } = getRequestContext();
    if (organizationId === undefined || !(await isEnabled(organizationId))) throw notAvailable();
    next();
  };
}

export function buildCustomerAuth(
  config: AppConfig,
  clock: Clock,
  input: StorefrontRouterInput,
): {
  readonly customerAuth: ReturnType<typeof authenticateCustomer>;
  readonly customerAuthOptional: ReturnType<typeof authenticateCustomerOptional>;
  readonly secret: string;
} {
  const secret = config.auth.accessTokenSecret;
  const maxStale = input.accountStatusMaxStaleSeconds ?? ACCOUNT_STATUS_MAX_STALE_SECONDS;
  const accounts = cacheAccountStatus(buildCustomerAccountStatusReader(), {
    clock,
    maxStaleSeconds: maxStale,
  });
  const verifier = createCustomerTokenVerifier({ secret, clock });
  return {
    customerAuth: authenticateCustomer({ verifier, accounts }),
    customerAuthOptional: authenticateCustomerOptional({ verifier, accounts }),
    secret,
  };
}
