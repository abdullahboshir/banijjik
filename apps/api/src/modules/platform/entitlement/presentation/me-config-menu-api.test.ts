import { ACCESS_MODE, SUBSCRIPTION_STATUS, TRIAL_DAYS } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  createTwoOrganizations,
  type ApiActor,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";

registerIamApiModels();

const DAY_MS = 24 * 60 * 60 * 1000;
const ORGANIZATION_MENU_KEYS = {
  profile: "organization.profile",
  locations: "organization.locations",
  staff: "organization.staff",
} as const;

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi();
});

afterAll(async () => {
  await harness.dispose();
});

function aWorld(): Promise<TwoOrganizations> {
  return createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
}

async function menuKeysOf(actor: ApiActor, organizationId: string): Promise<string[]> {
  const response = await actor.call("get", `/orgs/${organizationId}/me/config`);
  return response.body.data.menu.map((entry: { menuKey: string }) => entry.menuKey);
}

describe("the settings menu of the organization module", () => {
  it("gives the owner of a one-location organization Business profile and Staff but not Locations", async () => {
    const world = await aWorld();

    const menuKeys = await menuKeysOf(world.bob, world.organizationB);

    expect(menuKeys).toEqual([ORGANIZATION_MENU_KEYS.profile, ORGANIZATION_MENU_KEYS.staff]);
  });

  it("shows Locations on the next config after a second location is created, and hides it again after the archive", async () => {
    const world = await aWorld();
    const created = await world.bob.call("post", `/orgs/${world.organizationB}/locations`, {
      name: "Second shop",
      locationType: "STORE",
    });

    const withTwo = await menuKeysOf(world.bob, world.organizationB);
    const archived = await world.bob.call(
      "post",
      `/orgs/${world.organizationB}/locations/${created.body.data.locationId}/archive`,
      { version: created.body.data.version },
    );
    const withOneAgain = await menuKeysOf(world.bob, world.organizationB);

    expect(created.status).toBe(201);
    expect(withTwo).toEqual([
      ORGANIZATION_MENU_KEYS.profile,
      ORGANIZATION_MENU_KEYS.locations,
      ORGANIZATION_MENU_KEYS.staff,
    ]);
    expect(archived.status).toBe(200);
    expect(withOneAgain).toEqual([ORGANIZATION_MENU_KEYS.profile, ORGANIZATION_MENU_KEYS.staff]);
  });

  it("gives a staff member no settings entries", async () => {
    const world = await aWorld();

    const menuKeys = await menuKeysOf(world.sam, world.organizationA);

    expect(menuKeys).toEqual([]);
  });
});

describe("the subscription summary of the config", () => {
  it("tells the banners the status, the trial end and the past-due flag", async () => {
    const world = await aWorld();

    const response = await world.bob.call("get", `/orgs/${world.organizationB}/me/config`);

    const { subscription, accessMode } = response.body.data;
    expect(accessMode).toBe(ACCESS_MODE.FULL);
    expect(subscription).toMatchObject({ status: SUBSCRIPTION_STATUS.TRIALING, isPastDue: false });
    const trialEndsAt = new Date(subscription.trialEndsAt as string).getTime();
    expect(trialEndsAt - harness.clock.now().getTime()).toBeLessThanOrEqual(TRIAL_DAYS * DAY_MS);
    expect(trialEndsAt - harness.clock.now().getTime()).toBeGreaterThan(0);
  });
});

describe("the permission definitions of the config", () => {
  it("lists every permission of the effective modules with its module and sensitivity", async () => {
    const world = await aWorld();

    const response = await world.bob.call("get", `/orgs/${world.organizationB}/me/config`);

    const definitions: { permissionKey: string; isSensitive: boolean; moduleKey: string }[] =
      response.body.data.permissionDefinitions;
    const ownershipTransfer = definitions.find(
      (definition) => definition.permissionKey === "organization.ownership.transfer",
    );
    const profileUpdate = definitions.find(
      (definition) => definition.permissionKey === "organization.profile.update",
    );
    expect(ownershipTransfer).toMatchObject({ isSensitive: true, moduleKey: "organization" });
    expect(profileUpdate).toMatchObject({ isSensitive: false, moduleKey: "organization" });
    expect(profileUpdate).toHaveProperty("labelKey", "permission.organization.profile.update");
  });

  it("gives a staff member the same definitions, which carry no grant", async () => {
    const world = await aWorld();

    const response = await world.sam.call("get", `/orgs/${world.organizationA}/me/config`);

    expect(response.body.data.permissionDefinitions.length).toBeGreaterThan(0);
  });
});
