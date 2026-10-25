import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { asId, type PosSessionId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTransaction } from "../../../../kernel/db/index.js";
import {
  memberWithRole,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { withOrganizationContext } from "../../../../test-support/organization-context.js";
import { openRegister, pairedTill } from "../../../../test-support/pos-api-world.js";
import { MongoPosSessionRepository } from "./mongo-pos-session.repository.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

describe("register session against a racing sale", () => {
  it("two real transactions: a sale that commits after the close read makes the close retry on the new state", async () => {
    const world = await worldFor(harness, RETAIL);
    const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
    const till = await pairedTill(harness.app, {
      manager: world.alice,
      cashier,
      organizationId: world.organizationA,
      locationId: world.locationA1,
    });
    const session = await openRegister(till, 0);
    const sessions = new MongoPosSessionRepository();
    const posSessionId = asId<PosSessionId>(session.posSessionId);
    let attempts = 0;
    let closeMayWrite: () => void = () => undefined;
    const saleCommitted = new Promise<void>((resolve) => {
      closeMayWrite = resolve;
    });
    let startSale: () => void = () => undefined;
    const closeHasRead = new Promise<void>((resolve) => {
      startSale = resolve;
    });
    // Started outside the close transaction, so it is a second, independent transaction.
    const sellInOwnTransaction = (async () => {
      await closeHasRead;
      await withOrganizationContext(world.organizationA, () =>
        withTransaction(async () => {
          expect(await sessions.markSale(posSessionId, new Date())).toBe(true);
        }),
      );
      closeMayWrite();
    })();

    const closed = await withOrganizationContext(world.organizationA, () =>
      withTransaction(async () => {
        attempts += 1;
        const open = await sessions.findById(posSessionId);
        if (open === undefined) throw new Error("session missing");
        if (attempts === 1) {
          startSale();
          await saleCommitted;
        }
        return sessions.close({ ...open, status: "CLOSED" }, open.version);
      }),
    );
    await sellInOwnTransaction;

    expect(attempts).toBe(2);
    expect(closed.status).toBe("CLOSED");
    expect(closed.lastSaleAt).not.toBeNull();
  });
});
