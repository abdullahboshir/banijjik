import { createServer } from "node:net";
import { API_PORT, ADMIN_PORT } from "../test-support/browser-stack";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MongoClient } from "mongodb";
import { newId } from "@banijjik/ids";
import { SYSTEM_ACCOUNT_SEEDS } from "@banijjik/contracts/accounting";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  gotoWhenHydrated,
  message,
  waitForPath,
  waitForText,
} from "../test-support/browser-helpers";
import {
  clickByName,
  closePage,
  openPage,
  PHONE_VIEWPORT,
  signInWithCookies,
} from "../test-support/browser-page";
import {
  seedOrganization,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "../test-support/initial-js-size";
let stack: BrowserStack;
let owner: SeededPerson;
let cashId: string;
let equityId: string;
beforeAll(async () => {
  await assertPortAvailable(API_PORT);
  await assertPortAvailable(ADMIN_PORT);
  stack = await startBrowserStack();
  owner = await seedPerson("হিসাবের মালিক");
  await seedOrganization(owner, "acme", "হিসাবের ব্যবসা");
  const client = await MongoClient.connect(stack.mongoUri);
  try {
    const platform = client.db("browser_platform");
    const tenant = client.db("browser_tenant");
    const organization = await platform.collection("organizations").findOne({ slug: "acme" });
    if (organization === null) throw new Error("organization");
    const organizationId = organization["organizationId"] as string;
    const now = new Date();
    await platform.collection("module_overrides").insertOne({
      moduleOverrideId: newId(),
      organizationId,
      moduleKey: "bookkeeping",
      effect: "PLATFORM_GRANT",
      reason: "browser fixture",
      expiresAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      updatedByUserId: null,
    });
    await platform
      .collection("organizations")
      .updateOne({ organizationId }, { $inc: { configVersion: 1 } });
    for (const seed of SYSTEM_ACCOUNT_SEEDS)
      await tenant.collection("accounts").updateOne(
        { organizationId, accountCode: seed.accountCode },
        {
          $setOnInsert: {
            ...seed,
            accountId: newId(),
            organizationId,
            version: 1,
            parentAccountCode: null,
            postingVersion: 0,
            isSystem: true,
            status: "ACTIVE",
            createdAt: now,
            updatedAt: now,
            createdByUserId: null,
            updatedByUserId: null,
          },
        },
        { upsert: true },
      );
    const cash = await tenant
      .collection("accounts")
      .findOne({ organizationId, accountCode: "CASH" });
    const equity = await tenant
      .collection("accounts")
      .findOne({ organizationId, accountCode: "OWNER_EQUITY" });
    cashId = String(cash?.["accountId"]);
    equityId = String(equity?.["accountId"]);
  } finally {
    await client.close();
  }
}, 120000);
afterAll(async () => {
  await stack?.stop();
});
describe("bookkeeping phone flow", () => {
  it("posts owner opening balances, shows the journal and balanced statement without horizontal scroll", async () => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(page, owner);
    await gotoWhenHydrated(page, "/acme/money/journal/new", "#entry-memo");
    await page.type("#entry-memo", "শুরুর মূলধন");
    await page.select("#account-0", cashId);
    await page.type("#debit-0", "1000");
    await page.select("#account-1", equityId);
    await page.type("#credit-1", "1000");
    await page.screenshot({ path: join(tmpdir(), "bookkeeping-entry.png"), fullPage: true });
    await clickByName(page, message("bookkeeping.post"));
    await waitForPath(page, "/acme/money/journal");
    await waitForText(page, "শুরুর মূলধন");
    await clickByName(page, message("bookkeeping.detail"));
    await page.waitForSelector('[role="dialog"]');
    await clickByName(page, message("bookkeeping.close"));
    await gotoWhenHydrated(page, "/acme/money/accounts", "main");
    await clickByName(page, message("bookkeeping.add"));
    await page.waitForSelector("#account-bn");
    await clickByName(page, message("bookkeeping.close"));
    await gotoWhenHydrated(page, "/acme/money/statements", "main");
    await waitForText(page, message("bookkeeping.balanced"));
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: join(tmpdir(), "bookkeeping-statements.png"), fullPage: true });
    const budgets: Record<string, number> = {};
    for (const path of [
      "/acme/money/accounts",
      "/acme/money/journal",
      "/acme/money/journal/new",
      "/acme/money/statements",
    ]) {
      const bytes = await measureInitialJs(page, path);
      budgets[path] = toKiB(bytes.gzipBytes);
      writeFileSync(
        join(tmpdir(), "bookkeeping-chunks-" + path.split("/").at(-1) + ".json"),
        JSON.stringify(bytes),
      );
      expect.soft(toKiB(bytes.gzipBytes), path).toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
    }
    writeFileSync(join(tmpdir(), "bookkeeping-budgets.json"), JSON.stringify(budgets));
    await closePage(page);
  });
});

async function assertPortAvailable(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const probe = createServer();
    probe.once("error", () => reject(new Error("Browser test port is already in use: " + port)));
    probe.listen(port, "127.0.0.1", () =>
      probe.close((error) => {
        if (error !== undefined) reject(error);
        else resolve();
      }),
    );
  });
}
