import { ERROR_CODE, MODULE_KEY } from "@banijjik/contracts";
import type { RequestHandler } from "express";
import type { AppConfig } from "../config/index.js";
import { getRequestContext } from "../kernel/context/index.js";
import { AppError, sendData } from "../kernel/http/index.js";
import { reportError } from "../kernel/observability/report-error.js";
import { runInOrganizationContext } from "../kernel/tenancy/index.js";
import {
  buildStorefrontHostReader,
  lookupPublishedStorefrontHost,
} from "../modules/commerce/website/index.js";
import type { StorefrontOrganizationReader } from "../modules/core/organization/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import { createMongoHostClaims } from "../modules/platform/operations/index.js";

export interface StorefrontResolveInput {
  readonly config: AppConfig;
  readonly orgConfig: OrgConfigService;
}

function reservedHostnamesOf(storefront: AppConfig["storefront"]): readonly string[] {
  return [...new Set([storefront.baseDomain, ...storefront.reservedHostnames])];
}

function notAvailable(): AppError {
  return new AppError({
    code: ERROR_CODE.NOT_FOUND,
    messageKey: "errors.storefront_not_available",
  });
}

/** GET /storefront/resolve — host to published site, or 404 / 503. */
export function buildStorefrontResolveHandler(
  input: StorefrontResolveInput,
  organizations: StorefrontOrganizationReader,
): RequestHandler {
  const { baseDomain } = input.config.storefront;
  const claims = createMongoHostClaims({
    baseDomain,
    reservedHostnames: reservedHostnamesOf(input.config.storefront),
  });
  const reader = buildStorefrontHostReader();

  return async (_request, response) => {
    const { host } = response.locals["validated"].query as { host: string };
    try {
      const site = await lookupPublishedStorefrontHost({
        host,
        baseDomain,
        nodeEnv: input.config.nodeEnv,
        claims,
        organizations,
        isWebsiteEffective: (organizationId) =>
          input.orgConfig.isModuleEffective(organizationId, MODULE_KEY.WEBSITE),
        runInOrganization: runInOrganizationContext,
        reader,
      });
      if (site === undefined) throw notAvailable();
      sendData(response, site);
    } catch (error) {
      if (error instanceof AppError && error.code === ERROR_CODE.NOT_FOUND) throw error;
      reportError(error, {
        requestId: getRequestContext().requestId,
        method: "GET",
        path: "/api/v1/storefront/resolve",
      });
      throw new AppError({ code: ERROR_CODE.RETRY_LATER });
    }
  };
}
