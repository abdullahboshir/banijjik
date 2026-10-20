import {
  ALL_LOCATIONS,
  MODULE_CLASS,
  MODULE_KEY,
  OFFERING_KIND,
  type ModuleManifest,
  type SystemRoleKey,
} from "@banijjik/contracts";
import { defineModule } from "../kernel/modules/index.js";
import { startIamApi, type IamApiHarness } from "./iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId } from "./rbac-world.js";
import {
  createTwoOrganizations,
  type ApiActor,
  type TwoOrganizations,
} from "./two-organizations.js";

/** Everything a probe module leaves empty: no permissions, menu, settings, events or limits. */
const EMPTY_PARTS = {
  dependsOn: [],
  requiresAnyKind: [],
  permissions: [],
  menu: [],
  settings: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: { emits: [], consumes: [] },
  limitKeys: [],
  sequenceKeys: [],
  routes: {},
  tenantCanDisable: false,
  moduleClass: MODULE_CLASS.CORE,
} as const;

/**
 * Stand-in for enrollment (card 3.7). Booking's real module provides SERVICE after card 3.6;
 * catalog tests still need PLAN until enrollment lands.
 */
export const ENROLLMENT_PROBE = defineModule({
  ...EMPTY_PARTS,
  key: MODULE_KEY.ENROLLMENT,
  path: "commerce/enrollment",
  providesKinds: [OFFERING_KIND.PLAN],
});

export const CATALOG_PROBES: readonly ModuleManifest[] = [ENROLLMENT_PROBE];

/**
 * The API with the enrollment kind provider registered. Booking is already in MODULE_MANIFESTS.
 * An empty `tenantRouters` list is what makes the harness build its own router, so the extra
 * manifests take effect.
 */
export function startCatalogApi(
  options: Omit<
    Parameters<typeof startIamApi>[0] & object,
    "extraManifests" | "tenantRouters"
  > = {},
): Promise<IamApiHarness> {
  return startIamApi({ ...options, tenantRouters: [], extraManifests: CATALOG_PROBES });
}

export function offeringsPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/offerings${suffix}`;
}

export function catalogPath(organizationId: string, suffix: string): string {
  return `/orgs/${organizationId}${suffix}`;
}

/**
 * Two organizations. Organizations can be created only from a published template and the seed
 * publishes RETAIL alone, so another template is put on organization A directly, the way the custom
 * field tests do it. The test file names the templates (lint R16 keeps template keys in test files):
 * `created` is the published one, `actual` the one organization A ends up with.
 */
export async function worldFor(
  harness: IamApiHarness,
  created: object,
  actual: object = created,
): Promise<TwoOrganizations> {
  const world = await createTwoOrganizations(harness.app, harness.connections, created);
  if (actual !== created) {
    await harness.connections.platform
      .collection("organizations")
      .updateOne(
        { organizationId: world.organizationA },
        { $set: actual, $inc: { configVersion: 1 } },
      );
  }
  return world;
}

/** A member of the first organization with the system role at every location. */
export async function memberWithRole(
  harness: IamApiHarness,
  world: TwoOrganizations,
  roleKey: SystemRoleKey,
): Promise<ApiActor> {
  const roleId = await findSystemRoleId(harness.connections, world.organizationA, roleKey);
  const added = await addMemberWithAssignments(harness.app, world.organizationA, [
    { locationId: ALL_LOCATIONS, roleId },
  ]);
  return added.actor;
}

export const BDT = "BDT";

export function money(amount: number): { amount: number; currency: string } {
  return { amount, currency: BDT };
}
