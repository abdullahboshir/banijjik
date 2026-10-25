import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  memberWithRole,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { pairedTill, tillCall, type PosTill } from "../../../../test-support/pos-api-world.js";
import {
  publishOffering,
  shopOf,
  type SalesShop,
} from "../../../../test-support/sales-api-world.js";
import { offeringsPath } from "../../../../test-support/catalog-world.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

interface SnapshotItem {
  readonly offeringId: string;
  readonly variantId: string;
  readonly offeringName: string;
  readonly price: { amount: number };
  readonly kind: string;
}

interface Snapshot {
  readonly items: readonly SnapshotItem[];
  readonly removed: readonly { offeringId: string; variantId: string }[];
  readonly nextCursor: string | null;
  readonly serverTime: string;
}

async function aTill(): Promise<{ shop: SalesShop; till: PosTill; secondLocationId: string }> {
  const world = await worldFor(harness, RETAIL);
  const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
  const till = await pairedTill(harness.app, {
    manager: world.alice,
    cashier,
    organizationId: world.organizationA,
    locationId: world.locationA1,
  });
  return { shop: shopOf(world), till, secondLocationId: world.locationA2 };
}

async function snapshotOf(till: PosTill, query = ""): Promise<Snapshot> {
  const response = await tillCall(till, {
    method: "get",
    suffix: `/catalog-snapshot${query}`,
  });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return response.body.data as Snapshot;
}

describe("POS catalog snapshot", () => {
  it("returns only active sellable variants of the device's location and only changes since a time", async () => {
    const { shop, till, secondLocationId } = await aTill();
    const rice = await publishOffering(shop, { kind: "PRODUCT", name: "Rice", priceAmount: 9_000 });
    const lentil = await publishOffering(shop, {
      kind: "PRODUCT",
      name: "Lentil",
      priceAmount: 12_000,
    });
    const hidden = await publishOffering(shop, {
      kind: "PRODUCT",
      name: "Hidden",
      priceAmount: 500,
    });
    const draft = await shop.actor.call("post", offeringsPath(shop.organizationId), {
      kind: "PRODUCT",
      name: "Not published",
      variants: [{ name: "Default", price: { amount: 100, currency: "BDT" }, unitKey: "PIECE" }],
    });
    expect(draft.status).toBe(201);
    // The shop switches "Hidden" off at this location only.
    await harness.connections.tenantShared.collection("offering_locations").insertOne({
      offeringLocationId: newId(),
      organizationId: shop.organizationId,
      offeringId: hidden.offeringId,
      variantId: null,
      locationId: till.locationId,
      isAvailable: false,
      version: 1,
    });

    // The test clock stands still; the stored times are real, so the snapshot time follows them.
    harness.clock.setNow(new Date());
    const first = await snapshotOf(till);
    const none = await snapshotOf(till, `?since=${encodeURIComponent(first.serverTime)}`);
    const lentilNow = await shop.actor.call(
      "get",
      offeringsPath(shop.organizationId, `/${lentil.offeringId}`),
    );
    const archived = await shop.actor.call(
      "post",
      offeringsPath(shop.organizationId, `/${lentil.offeringId}/archive`),
      { version: lentilNow.body.data.version },
    );
    expect(archived.status, JSON.stringify(archived.body)).toBe(200);
    const edited = await publishOffering(shop, {
      kind: "PRODUCT",
      name: "Oil",
      priceAmount: 20_000,
    });
    const changes = await snapshotOf(till, `?since=${encodeURIComponent(first.serverTime)}`);

    expect(first.items.map((item) => item.offeringName).sort()).toEqual(["Rice", "Lentil"].sort());
    expect(first.items.find((item) => item.offeringId === rice.offeringId)?.price.amount).toBe(
      9_000,
    );
    expect(first.items.every((item) => item.kind === "PRODUCT")).toBe(true);
    expect(first.nextCursor).toBeNull();
    expect(none.items).toEqual([]);
    expect(changes.items.map((item) => item.offeringId)).toEqual([edited.offeringId]);
    expect(changes.removed).toEqual([
      { offeringId: lentil.offeringId, variantId: lentil.variantId },
    ]);
    expect(secondLocationId).not.toBe(till.locationId);
  });

  it("pages with a keyset cursor, every offering once, and refuses a broken cursor", async () => {
    const { shop, till } = await aTill();
    const created = [];
    for (const name of ["A", "B", "C", "D", "E"]) {
      created.push(await publishOffering(shop, { kind: "PRODUCT", name, priceAmount: 100 }));
    }

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page: Snapshot = await snapshotOf(
        till,
        `?limit=2${cursor === null ? "" : `&cursor=${encodeURIComponent(cursor)}`}`,
      );
      seen.push(...page.items.map((item) => item.offeringId));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor !== null);
    const broken = await tillCall(till, {
      method: "get",
      suffix: "/catalog-snapshot?cursor=not-a-cursor",
    });
    const tooBig = await tillCall(till, { method: "get", suffix: "/catalog-snapshot?limit=501" });

    expect(pages).toBe(3);
    expect(seen).toHaveLength(5);
    expect(new Set(seen)).toEqual(new Set(created.map((offering) => offering.offeringId)));
    expect(broken.status).toBe(400);
    expect(tooBig.status).toBe(400);
  });
});
