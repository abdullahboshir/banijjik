import {
  MODULE_KEY,
  PERMISSION_KEY,
  type ModuleKey,
  type ModuleOverrideEffect,
} from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { Router } from "express";
import { getActiveSession, models, sessionOption, withTransaction } from "../kernel/db/index.js";
import { sendData } from "../kernel/http/index.js";
import { buildConfigVersionBumper } from "../modules/core/organization/index.js";
import {
  MODULE_OVERRIDE_MODEL_NAME,
  type ModuleOverrideDocument,
} from "../modules/platform/entitlement/infrastructure/module-override.schema.js";
import { withOrganizationContext } from "./organization-context.js";
import { optionalProbeManifest } from "./probe-manifests.js";

/** An OPTIONAL module that BUNDLE contains and the tenant may disable. */
export const WORKFLOW_PROBE_MANIFEST = optionalProbeManifest({
  key: MODULE_KEY.WORKFLOW,
  routePrefix: "/flows",
  tenantCanDisable: true,
  menuPermissionKeys: [PERMISSION_KEY.ORGANIZATION_LOCATION_READ, PERMISSION_KEY.IAM_ROLE_READ],
});

/** An OPTIONAL module that no package of the trial contains and the tenant may not disable. */
export const PAYMENT_GATEWAY_PROBE_MANIFEST = optionalProbeManifest({
  key: MODULE_KEY.PAYMENT_GATEWAY,
  routePrefix: "/ledger",
  tenantCanDisable: false,
});

/** Routes of the two probe modules, plus one route that no manifest owns. */
export function buildEntitlementProbeRouter(): Router {
  const router = Router({ mergeParams: true });
  router.get("/flows", (_request, response) => sendData(response, { module: "workflow" }));
  router.post("/flows", (_request, response) =>
    sendData(response, { module: "workflow" }, { status: 201 }),
  );
  router.get("/ledger", (_request, response) => sendData(response, { module: "payment-gateway" }));
  router.get("/forgotten", (_request, response) => sendData(response, { module: "none" }));
  return router;
}

export interface OverrideRequest {
  readonly organizationId: string;
  readonly moduleKey: ModuleKey;
  readonly effect: ModuleOverrideEffect;
  readonly expiresAt?: Date;
}

/**
 * Writes a ModuleOverride and bumps `configVersion` in one transaction, the way the platform
 * panel will (card 1.8): the next request of the organization sees the change.
 */
export async function writeModuleOverride(request: OverrideRequest): Promise<void> {
  const { organizationId } = request;
  await withOrganizationContext(organizationId, () =>
    withTransaction(async () => {
      await models({})
        .get<ModuleOverrideDocument>(MODULE_OVERRIDE_MODEL_NAME)
        .create(
          [
            {
              moduleOverrideId: newId(),
              organizationId,
              moduleKey: request.moduleKey,
              effect: request.effect,
              reason: "test",
              expiresAt: request.expiresAt ?? null,
              version: 1,
              createdByUserId: null,
              updatedByUserId: null,
            },
          ],
          sessionOption(getActiveSession()),
        );
      await buildConfigVersionBumper().bump(organizationId);
    }),
  );
}

/** Removes the overrides of a module and bumps `configVersion`, like a platform panel "undo". */
export async function removeModuleOverrides(
  organizationId: string,
  moduleKey: ModuleKey,
): Promise<void> {
  await withOrganizationContext(organizationId, () =>
    withTransaction(async () => {
      await models({})
        .get<ModuleOverrideDocument>(MODULE_OVERRIDE_MODEL_NAME)
        .deleteMany({ moduleKey }, sessionOption(getActiveSession()));
      await buildConfigVersionBumper().bump(organizationId);
    }),
  );
}
