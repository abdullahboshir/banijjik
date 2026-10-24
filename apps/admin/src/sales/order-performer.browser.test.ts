import { PACKAGE_KEY } from "@banijjik/contracts";
import { MongoClient } from "mongodb";
import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gotoWhenHydrated } from "../test-support/browser-helpers";
import {
  closePage,
  openPage,
  PHONE_VIEWPORT,
  signInWithCookies,
} from "../test-support/browser-page";
import { publishTemplate } from "../test-support/browser-seed";
import {
  seedLocation,
  seedOrganizationWithBody,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "../test-support/initial-js-size";
import salonFixture from "../test-support/salon-industry-fixture.json" with { type: "json" };

const ORG_SLUG = "salon-performer";
const ORG_PATH = `/${ORG_SLUG}`;
const NEW_ORDER_PATH = `${ORG_PATH}/orders/new`;
const PERFORMER_SELECT = "#order-performer-0";

let stack: BrowserStack;
let owner: SeededPerson;

/**
 * Attaches the commission add-on to the business the way the platform admin does, then bumps
 * `configVersion` so the next request rebuilds the cached organization config.
 */
async function enableCommissionAddOn(): Promise<void> {
  const client = await MongoClient.connect(stack.mongoUri);
  try {
    const platform = client.db("browser_platform");
    const addOn = await platform
      .collection("packages")
      .findOne({ packageKey: PACKAGE_KEY.ADDON_COMMISSION });
    const addOnPackageId = addOn?.["packageId"];
    if (typeof addOnPackageId !== "string") {
      throw new Error("The ADDON_COMMISSION package was not seeded");
    }
    const organization = await platform.collection("organizations").findOne({ slug: ORG_SLUG });
    const organizationId = organization?.["organizationId"];
    if (typeof organizationId !== "string") throw new Error(`No business with slug ${ORG_SLUG}`);
    await platform
      .collection("platform_subscriptions")
      .updateOne({ organizationId }, { $addToSet: { addOnPackageIds: addOnPackageId } });
    await platform
      .collection("organizations")
      .updateOne({ slug: ORG_SLUG }, { $inc: { configVersion: 1 } });
  } finally {
    await client.close();
  }
}

async function ownerPage(): Promise<Page> {
  const page = await openPage(stack.browser, PHONE_VIEWPORT);
  await signInWithCookies(page, owner);
  return page;
}

beforeAll(async () => {
  stack = await startBrowserStack();
  await publishTemplate(stack, "SALON");
  owner = await seedPerson("পারফরমার মালিক");
  await seedOrganizationWithBody(owner, {
    name: "পারফরমার সেলুন",
    slug: ORG_SLUG,
    ...salonFixture,
  });
  await seedLocation(owner, ORG_SLUG, "মূল শাখা");
  await enableCommissionAddOn();
}, 180_000);

afterAll(async () => {
  await stack?.stop();
});

describe("the Done by select on a new order", () => {
  it("offers the staff of the location on each line once the commission module is on", async () => {
    const page = await ownerPage();

    await gotoWhenHydrated(page, NEW_ORDER_PATH, "main");
    await page.waitForSelector(PERFORMER_SELECT, { visible: true });
    await page.waitForFunction(
      (ownerName) =>
        Array.from(document.querySelectorAll("#order-performer-0 option")).some(
          (option) => option.textContent === ownerName,
        ),
      {},
      owner.name,
    );
    expect(
      await page.$eval(PERFORMER_SELECT, (element) => (element as HTMLSelectElement).value),
    ).toBe("");
    expect(
      await page.$$eval("#order-performer-0 option", (options) => options.length),
    ).toBeGreaterThan(1);
    await closePage(page);
  }, 180_000);

  it("keeps the new-order route within the initial JavaScript budget", async () => {
    const page = await ownerPage();
    const size = await measureInitialJs(page, NEW_ORDER_PATH);
    process.stdout.write(`initial JS new order with performer: ${toKiB(size.gzipBytes)} KiB\n`);
    await closePage(page);

    expect(toKiB(size.gzipBytes), "new order").toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
  });
});
