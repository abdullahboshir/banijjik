import { ALL_LOCATIONS, type SystemRoleKey } from "@banijjik/contracts";

import { startIamApi, type IamApiHarness } from "./iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId } from "./rbac-world.js";
import {
  createTwoOrganizations,
  type ApiActor,
  type TwoOrganizations,
} from "./two-organizations.js";

/** Catalog tests now use the production SERVICE and PLAN providers. */
export function startCatalogApi(
  options: Omit<
    Parameters<typeof startIamApi>[0] & object,
    "extraManifests" | "tenantRouters"
  > = {},
): Promise<IamApiHarness> {
  return startIamApi({ ...options, tenantRouters: [], extraManifests: [] });
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
