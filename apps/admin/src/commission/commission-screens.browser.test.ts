import { PACKAGE_KEY } from "@banijjik/contracts";
import { MongoClient } from "mongodb";
import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bodyText,
  clickInDialog,
  gotoWhenHydrated,
  message,
  waitForTextIn,
} from "../test-support/browser-helpers";
import {
  clickByName,
  closePage,
  openPage,
  PHONE_VIEWPORT,
  signInWithCookies,
  waitForDialogSettled,
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

const ORG_SLUG = "salon-commission";
const ORG_PATH = `/${ORG_SLUG}`;
const MINIMUM_TOUCH_TARGET = 43.5;

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

async function firstMemberOption(page: Page): Promise<string> {
  const value = await page.$eval("#commission-rule-member", (element) => {
    const select = element as HTMLSelectElement;
    return Array.from(select.options).find((option) => option.value !== "")?.value ?? "";
  });
  if (value === "") throw new Error("The rule sheet has no member to choose");
  return value;
}

async function waitForSheetClosed(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelector("[role=dialog]") === null);
}

async function waitForRuleRow(page: Page, text: string): Promise<void> {
  await page.waitForFunction(
    (wanted) =>
      Array.from(document.querySelectorAll("main ul li")).some((row) =>
        row.textContent?.includes(wanted),
      ),
    {},
    text,
  );
}

beforeAll(async () => {
  stack = await startBrowserStack();
  await publishTemplate(stack, "SALON");
  owner = await seedPerson("কমিশন মালিক");
  await seedOrganizationWithBody(owner, {
    name: "সালমা কমিশন পার্লার",
    slug: ORG_SLUG,
    ...salonFixture,
  });
  await seedLocation(owner, ORG_SLUG, "মূল শাখা");
  await enableCommissionAddOn();
}, 180_000);

afterAll(async () => {
  await stack?.stop();
});

describe("commission screens", () => {
  it("creates, edits and archives a rule, then opens the empty money screens", async () => {
    const page = await ownerPage();

    await gotoWhenHydrated(page, `${ORG_PATH}/commission/rules`, "main button");
    await clickByName(page, message("commission.rules.add"));
    await waitForDialogSettled(page);
    await page.waitForSelector("#commission-rule-member");
    await page.select("#commission-rule-member", await firstMemberOption(page));
    await page.type("#commission-rule-percent", "10");
    await clickInDialog(page, message("commission.rule.form.submit"));
    await waitForSheetClosed(page);
    await waitForRuleRow(page, "10%");
    expect(await bodyText(page)).toContain(owner.name);

    await clickByName(page, message("commission.rules.edit"));
    await waitForDialogSettled(page);
    await page.waitForSelector("#commission-rule-percent");
    await page.click("#commission-rule-percent", { clickCount: 3 });
    await page.keyboard.press("Backspace");
    await page.type("#commission-rule-percent", "12.5");
    await clickInDialog(page, message("commission.rule.form.submit"));
    await waitForSheetClosed(page);
    await waitForRuleRow(page, "12.5%");

    await clickByName(page, message("commission.rules.archive"));
    await waitForRuleRow(page, message("commission.status.ARCHIVED"));

    await gotoWhenHydrated(page, `${ORG_PATH}/commission/entries`, "main");
    await waitForTextIn(page, "main", message("commission.entries.empty"));
    await waitForTextIn(page, "main", message("commission.summary.empty"));

    await gotoWhenHydrated(page, `${ORG_PATH}/commission/payouts`, "main");
    await waitForTextIn(page, "main", message("commission.payouts.empty"));
    await waitForTextIn(page, "main", message("commission.summary.empty"));

    await gotoWhenHydrated(page, `${ORG_PATH}/commission/mine`, "main");
    await waitForTextIn(page, "main", message("commission.entries.empty"));

    await closePage(page);
  }, 180_000);
});

describe("the commission screens on a phone and their first load", () => {
  const routes = [
    ["rules", `${ORG_PATH}/commission/rules`],
    ["entries", `${ORG_PATH}/commission/entries`],
    ["payouts", `${ORG_PATH}/commission/payouts`],
    ["mine", `${ORG_PATH}/commission/mine`],
  ] as const;

  it.each(routes)("%s stays within the initial JavaScript budget", async (name, path) => {
    const page = await ownerPage();
    const size = await measureInitialJs(page, path);
    process.stdout.write(`initial JS commission ${name}: ${toKiB(size.gzipBytes)} KiB\n`);
    await closePage(page);

    expect(toKiB(size.gzipBytes), name).toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
  });

  it.each(routes)("%s has no sideways scroll and touch targets of 44 px", async (name, path) => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, path, "main");
    await page.waitForFunction(() => document.querySelector("main form, main ul, main p") !== null);
    const report = await page.evaluate((minimum) => {
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const controls = Array.from(
        document.querySelectorAll(
          "main button, main a, main select, main input:not([type=file]):not([type=checkbox]), main textarea",
        ),
      );
      const small = controls
        .filter((control) => control.getClientRects().length > 0)
        .filter((control) => control.getBoundingClientRect().height < minimum)
        .map((control) => `${control.tagName} ${control.textContent?.trim().slice(0, 20)}`);
      return { overflow, small };
    }, MINIMUM_TOUCH_TARGET);
    await closePage(page);

    expect(report.overflow, name).toBeLessThanOrEqual(0);
    expect(report.small, name).toEqual([]);
  });
});
