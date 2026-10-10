import { ERROR_CODE, ME_CONFIG_PATH, type ModuleKey } from "@banijjik/contracts";
import type { RequestHandler } from "express";
import { AppError } from "../http/app-error.js";
import type { ModuleRegistry } from "../modules/index.js";
import type { GateOrgConfig, OrgConfigReader } from "./org-config-reader.js";

export interface EntitlementOptions {
  readonly registry: ModuleRegistry;
  readonly config: OrgConfigReader;
}

const READ_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

function isReadOnlyRefusal(config: GateOrgConfig, method: string): boolean {
  return config.accessMode === "READ_ONLY" && !READ_METHODS.has(method);
}

const ME_CONFIG_PATTERN = new RegExp(`^${ME_CONFIG_PATH.replace(":organizationId", "[^/]+")}/?$`);

/** `/orgs/<id>/me/config`, whatever the id: the one path that has no owner module (ADR-091). */
function isAllowListed(path: string): boolean {
  return ME_CONFIG_PATTERN.test(path);
}

function assertModuleIsEffective(moduleKey: ModuleKey, config: GateOrgConfig): void {
  if (config.modules.includes(moduleKey)) return;
  throw new AppError({ code: ERROR_CODE.MODULE_DISABLED, details: { moduleKey } });
}

/**
 * The entitlement gate (01 section 3, 10-MODULE-CATALOG section 8, ADR-091), mounted once in
 * routes/v1.ts after locationAccess. In order: a READ_ONLY organization cannot write
 * (ORG_READ_ONLY); a route whose owner module is not effective answers MODULE_DISABLED; a
 * tenant path that no manifest owns fails closed (INTERNAL), so a router that forgot its manifest never serves.
 */
export function createEntitlementGate(options: EntitlementOptions): RequestHandler {
  const { registry, config: configReader } = options;
  return async (request, _response, next) => {
    const config = await configReader.current();
    if (isReadOnlyRefusal(config, request.method)) {
      throw new AppError({ code: ERROR_CODE.ORG_READ_ONLY });
    }
    const path = `/orgs/${String(request.params["organizationId"])}${request.path}`;
    if (!isAllowListed(path)) {
      const owner = registry.ownerOfRoute(path);
      if (owner === undefined) {
        throw new AppError({
          code: ERROR_CODE.INTERNAL,
          messageKey: "errors.route_without_module",
        });
      }
      assertModuleIsEffective(owner.key, config);
    }
    next();
  };
}
