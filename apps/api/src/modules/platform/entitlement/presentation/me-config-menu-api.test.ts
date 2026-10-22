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
  branding: "organization.branding",
  locations: "organization.locations",
  staff: "organization.staff",
  roles: "iam.roles",
} as const;
/** Settings and fields entries every member who may read them sees (card 2.7b). */
// The owner and staff hold contact.contact.read, so the contacts entry leads their menu.
const CONTACTS_MENU_KEY = "contact.contacts";
// Every role reads the catalog (card 3.2a), so its three entries sit in every menu.
// Promotions need pricing.promotion.read (OWNER/MANAGER/CASHIER/STAFF/VIEWER).
const CATALOG_MENU_KEYS = {
  offerings: "catalog.offerings",
  categories: "catalog.categories",
  modifierGroups: "catalog.modifierGroups",
  promotions: "catalog.promotions",
  stock: "catalog.stock",
  transfers: "catalog.transfers",
  adjustments: "catalog.adjustments",
} as const;
const EXPENSE_MENU_KEYS = {
  expenses: "expense.expenses",
  categories: "expense.categories",
} as const;
const PAYMENT_MENU_KEY = "payment.payments";
const ACCOUNTING_TRIAL_BALANCE_MENU_KEY = "accounting.trialBalance";
const TAX_CLASSES_MENU_KEY = "pricing.taxClasses";
// Sales is a CORE module, so its entry joins the menu of every template (card 3.5a).
const SALES_ORDERS_MENU_KEY = "sales.orders";

const READ_ONLY_SETTINGS_MENU_KEYS = [
  "settings.general",
  "settings.terms",
  "settings.modules",
  "customField.fields",
];
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

    expect(menuKeys).toEqual([
      CATALOG_MENU_KEYS.offerings,
      CONTACTS_MENU_KEY,
      ORGANIZATION_MENU_KEYS.profile,
      SALES_ORDERS_MENU_KEY,
      ORGANIZATION_MENU_KEYS.branding,
      CATALOG_MENU_KEYS.categories,
      EXPENSE_MENU_KEYS.expenses,
      CATALOG_MENU_KEYS.modifierGroups,
      EXPENSE_MENU_KEYS.categories,
      ORGANIZATION_MENU_KEYS.staff,
      PAYMENT_MENU_KEY,
      CATALOG_MENU_KEYS.promotions,
      CATALOG_MENU_KEYS.stock,
      ORGANIZATION_MENU_KEYS.roles,
      CATALOG_MENU_KEYS.transfers,
      READ_ONLY_SETTINGS_MENU_KEYS[0],
      TAX_CLASSES_MENU_KEY,
      CATALOG_MENU_KEYS.adjustments,
      ...READ_ONLY_SETTINGS_MENU_KEYS.slice(1),
      ACCOUNTING_TRIAL_BALANCE_MENU_KEY,
    ]);
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
      CATALOG_MENU_KEYS.offerings,
      CONTACTS_MENU_KEY,
      ORGANIZATION_MENU_KEYS.profile,
      SALES_ORDERS_MENU_KEY,
      ORGANIZATION_MENU_KEYS.branding,
      CATALOG_MENU_KEYS.categories,
      EXPENSE_MENU_KEYS.expenses,
      ORGANIZATION_MENU_KEYS.locations,
      CATALOG_MENU_KEYS.modifierGroups,
      EXPENSE_MENU_KEYS.categories,
      ORGANIZATION_MENU_KEYS.staff,
      PAYMENT_MENU_KEY,
      CATALOG_MENU_KEYS.promotions,
      CATALOG_MENU_KEYS.stock,
      ORGANIZATION_MENU_KEYS.roles,
      CATALOG_MENU_KEYS.transfers,
      READ_ONLY_SETTINGS_MENU_KEYS[0],
      TAX_CLASSES_MENU_KEY,
      CATALOG_MENU_KEYS.adjustments,
      ...READ_ONLY_SETTINGS_MENU_KEYS.slice(1),
      ACCOUNTING_TRIAL_BALANCE_MENU_KEY,
    ]);
    expect(archived.status).toBe(200);
    expect(withOneAgain).toEqual([
      CATALOG_MENU_KEYS.offerings,
      CONTACTS_MENU_KEY,
      ORGANIZATION_MENU_KEYS.profile,
      SALES_ORDERS_MENU_KEY,
      ORGANIZATION_MENU_KEYS.branding,
      CATALOG_MENU_KEYS.categories,
      EXPENSE_MENU_KEYS.expenses,
      CATALOG_MENU_KEYS.modifierGroups,
      EXPENSE_MENU_KEYS.categories,
      ORGANIZATION_MENU_KEYS.staff,
      PAYMENT_MENU_KEY,
      CATALOG_MENU_KEYS.promotions,
      CATALOG_MENU_KEYS.stock,
      ORGANIZATION_MENU_KEYS.roles,
      CATALOG_MENU_KEYS.transfers,
      READ_ONLY_SETTINGS_MENU_KEYS[0],
      TAX_CLASSES_MENU_KEY,
      CATALOG_MENU_KEYS.adjustments,
      ...READ_ONLY_SETTINGS_MENU_KEYS.slice(1),
      ACCOUNTING_TRIAL_BALANCE_MENU_KEY,
    ]);
  });

  it("gives a staff member only the read-only settings and fields entries", async () => {
    const world = await aWorld();

    const menuKeys = await menuKeysOf(world.sam, world.organizationA);

    expect(menuKeys).toEqual([
      CATALOG_MENU_KEYS.offerings,
      CONTACTS_MENU_KEY,
      SALES_ORDERS_MENU_KEY,
      CATALOG_MENU_KEYS.categories,
      CATALOG_MENU_KEYS.modifierGroups,
      PAYMENT_MENU_KEY,
      CATALOG_MENU_KEYS.promotions,
      CATALOG_MENU_KEYS.stock,
      ...READ_ONLY_SETTINGS_MENU_KEYS,
    ]);
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
